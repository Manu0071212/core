#!/bin/bash
set -e

# Make sure we are in the script's directory or project root
# The script is located in infra/docker/bootstrap-snipeit.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Read FRONTEND_URL from apps/api/.env to derive the logout URL dynamically.
# This avoids hardcoding the domain or path prefix in this script.
ENV_FILE="$PROJECT_ROOT/apps/api/.env"
FRONTEND_URL=""
if [ -f "$ENV_FILE" ]; then
    FRONTEND_URL=$(grep -E '^FRONTEND_URL=' "$ENV_FILE" | head -n 1 | cut -d'=' -f2- | tr -d "'\"")
fi
if [ -z "$FRONTEND_URL" ]; then
    echo "WARNING: FRONTEND_URL not found in apps/api/.env. Using placeholder for Snipe-IT logout URL."
    echo "  Update FRONTEND_URL in apps/api/.env before deploying."
    FRONTEND_URL="https://CHANGE_ME"
fi
SNIPEIT_LOGOUT_URL="${FRONTEND_URL%/}/api/auth/logout"
echo "Snipe-IT custom logout URL will be set to: $SNIPEIT_LOGOUT_URL"

# Derive admin email domain from FRONTEND_URL
FRONTEND_DOMAIN=$(echo "$FRONTEND_URL" | sed 's|https\?://||' | cut -d'/' -f1)
ADMIN_EMAIL="admin@${FRONTEND_DOMAIN}"

echo "--------------------------------------------------"
echo "DETI Maker Lab - Snipe-IT Bootstrapping Tool"
echo "--------------------------------------------------"

# 1. Find the Snipe-IT container
CONTAINER_NAME=$(docker ps --filter "ancestor=snipe/snipe-it:v8.3.6" --format "{{.Names}}" | head -n 1)
if [ -z "$CONTAINER_NAME" ]; then
    CONTAINER_NAME=$(docker ps --filter "name=snipeit" --format "{{.Names}}" | head -n 1)
fi

if [ -z "$CONTAINER_NAME" ]; then
    echo "ERROR: Snipe-IT container is not running."
    echo "Please start the stack first using: docker compose -f infra/docker/docker-compose.yml up -d"
    exit 1
fi

echo "Found Snipe-IT container: $CONTAINER_NAME"

# 2. Ensure APP_KEY is valid
SNIPEIT_ENV="$PROJECT_ROOT/infra/snipeit/.env.snipeit"
CURRENT_KEY=$(grep -E '^APP_KEY=' "$SNIPEIT_ENV" | head -n 1 | cut -d'=' -f2-)

if [ -z "$CURRENT_KEY" ] || [ "$CURRENT_KEY" = "base64:/APP_KEY" ] || [ "$CURRENT_KEY" = "CHANGE_ME" ]; then
    echo "APP_KEY is missing or placeholder. Generating a new one..."
    NEW_KEY=$(docker exec "$CONTAINER_NAME" php artisan key:generate --show --no-interaction 2>/dev/null | tr -d '\r\n')

    if [ -z "$NEW_KEY" ]; then
        echo "ERROR: Failed to generate APP_KEY."
        exit 1
    fi

    # Update APP_KEY in .env.snipeit
    python3 -c "
import sys
key = sys.argv[1]
env_path = sys.argv[2]
with open(env_path, 'r') as f:
    lines = f.readlines()
updated = False
for i, line in enumerate(lines):
    if line.strip().startswith('APP_KEY='):
        lines[i] = f'APP_KEY={key}\n'
        updated = True
        break
if not updated:
    lines.append(f'APP_KEY={key}\n')
with open(env_path, 'w') as f:
    f.writelines(lines)
" "$NEW_KEY" "$SNIPEIT_ENV"

    echo "Generated APP_KEY and saved to $SNIPEIT_ENV"
    echo "Restarting Snipe-IT container to apply new key..."
    docker compose -f "$PROJECT_ROOT/infra/docker/docker-compose.yml" up -d snipeit
    sleep 5

    # Re-find container (may have new ID after restart)
    CONTAINER_NAME=$(docker ps --filter "ancestor=snipe/snipe-it:v8.3.6" --format "{{.Names}}" | head -n 1)
    if [ -z "$CONTAINER_NAME" ]; then
        CONTAINER_NAME=$(docker ps --filter "name=snipeit" --format "{{.Names}}" | head -n 1)
    fi
else
    echo "APP_KEY is already set."
fi

# 3. Wait for Snipe-IT initialization
echo "Waiting for Snipe-IT container to be fully initialized..."
MAX_ATTEMPTS=60
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    # Check if artisan is available and responsive
    if docker exec "$CONTAINER_NAME" php artisan --version >/dev/null 2>&1; then
        # Check if database schema is fully loaded
        if docker exec "$CONTAINER_NAME" php artisan tinker --execute="App\Models\User::count();" >/dev/null 2>&1; then
            echo "Snipe-IT is ready!"
            break
        fi
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt+1))
done

if [ $attempt -gt $MAX_ATTEMPTS ]; then
    echo "ERROR: Snipe-IT initialization timed out."
    exit 1
fi

# 4. Configure/Initialize settings to skip Snipe-IT setup wizard and enable Remote User login
echo "Configuring Snipe-IT settings..."
docker exec "$CONTAINER_NAME" php artisan tinker --execute="
\$s = App\Models\Setting::first() ?? new App\Models\Setting;
if (!\$s->exists) {
    \$s->site_name = 'DETI Maker Lab Inventory';
    \$s->brand = 1;
    \$s->per_page = 20;
    \$s->locale = 'en-US';
}
\$s->login_remote_user_enabled = 1;
\$s->login_remote_user_header_name = 'HTTP_X_REMOTE_USER';
\$s->login_remote_user_custom_logout_url = '${SNIPEIT_LOGOUT_URL}';
\$s->save();
echo 'Settings configured successfully!';
"

# 5. Create Admin Account if none exists
echo "Checking existing users..."
USER_COUNT=$(docker exec "$CONTAINER_NAME" php artisan tinker --execute="echo App\Models\User::count();" | tr -d '\r\n')
# Clean up any Laravel shell prompt or wrapper junk
USER_COUNT=$(echo "$USER_COUNT" | grep -oE '[0-9]+' | head -n 1)

if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -eq 0 ]; then
    echo "No admin user found. Creating technician admin account..."
    # Generate random strong password
    ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12)
    # Append a special character and uppercase to satisfy password policies
    ADMIN_PASS="${ADMIN_PASS}aA1!"

    docker exec "$CONTAINER_NAME" php artisan snipeit:create-admin \
        --first_name="Technician" \
        --last_name="Admin" \
        --email="$ADMIN_EMAIL" \
        --username="admin" \
        --password="$ADMIN_PASS" \
        --no-interaction

    echo "Admin created successfully!"
    echo "Username: admin"
    echo "Password: $ADMIN_PASS"
else
    echo "Admin account already exists ($USER_COUNT users found)."
fi

# 6. Ensure Passport encryption keys exist
echo "Checking Passport encryption keys..."
if ! docker exec "$CONTAINER_NAME" test -f storage/oauth-private.key >/dev/null 2>&1; then
    echo "Passport encryption keys missing. Generating keys..."
    docker exec "$CONTAINER_NAME" php artisan passport:keys --no-interaction
    docker exec "$CONTAINER_NAME" chown -R docker:root /var/lib/snipeit/keys
else
    echo "Passport encryption keys already exist."
    # Ensure they are readable just in case
    docker exec "$CONTAINER_NAME" chown -R docker:root /var/lib/snipeit/keys
fi

# 7. Generate Personal Access Client if missing
echo "Checking personal access client..."
CLIENT_EXISTS=$(docker exec "$CONTAINER_NAME" php artisan tinker --execute="echo Laravel\Passport\Client::where('personal_access_client', 1)->count();" | tr -d '\r\n')
CLIENT_EXISTS=$(echo "$CLIENT_EXISTS" | grep -oE '[0-9]+' | head -n 1)

if [ -z "$CLIENT_EXISTS" ] || [ "$CLIENT_EXISTS" -eq 0 ]; then
    echo "Creating Laravel Passport personal access client..."
    docker exec "$CONTAINER_NAME" php artisan passport:client --personal --no-interaction
else
    echo "Personal access client already exists."
fi

# 8. Generate Personal Access Token
echo "Generating API token..."
TOKEN_OUTPUT=$(docker exec "$CONTAINER_NAME" php artisan tinker --execute="echo App\Models\User::first()->createToken('BootstrapToken')->accessToken;")
# Clean up token output to make sure it contains only the JWT string
TOKEN=$(echo "$TOKEN_OUTPUT" | tr -d '\r\n' | grep -oE 'eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+')

if [ -z "$TOKEN" ]; then
    echo "ERROR: Failed to generate Snipe-IT API Token."
    exit 1
fi

echo "API Token generated successfully!"

# 9. Update environment variables in apps/api/.env
if [ ! -f "$ENV_FILE" ]; then
    echo "Warning: apps/api/.env file does not exist. Creating from example..."
    cp "$PROJECT_ROOT/apps/api/.env.example" "$ENV_FILE"
fi

# Update or insert SNIPEIT_API_TOKEN in .env using Python to avoid sed escaping issues
python3 -c "
import sys
token = sys.argv[1]
env_path = sys.argv[2]
with open(env_path, 'r') as f:
    lines = f.readlines()
updated = False
for i, line in enumerate(lines):
    if line.strip().startswith('SNIPEIT_API_TOKEN='):
        lines[i] = f'SNIPEIT_API_TOKEN={token}\n'
        updated = True
        break
if not updated:
    lines.append(f'\nSNIPEIT_API_TOKEN={token}\n')
with open(env_path, 'w') as f:
    f.writelines(lines)
" "$TOKEN" "$ENV_FILE"

echo "Updated SNIPEIT_API_TOKEN in $ENV_FILE"

# 10. Restart API container
echo "Restarting API service to load the new token..."
docker compose -f "$PROJECT_ROOT/infra/docker/docker-compose.yml" up -d --build api

echo "--------------------------------------------------"
echo "Snipe-IT Bootstrapping Completed Successfully!"
echo "--------------------------------------------------"