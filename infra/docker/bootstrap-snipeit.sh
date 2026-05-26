#!/bin/bash
set -e

# Make sure we are in the script's directory or project root
# The script is located in infra/docker/bootstrap-snipeit.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

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

# 2. Wait for Snipe-IT initialization
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

# 3. Configure/Initialize settings to skip Snipe-IT setup wizard and enable Remote User login
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
\$s->login_remote_user_custom_logout_url = 'https://deti-makerlab.ua.pt/api/auth/logout';
\$s->save();
echo 'Settings configured successfully!';
"

# 4. Create Admin Account if none exists
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
        --last_name="Smith" \
        --email="noreply@deti-makerlab.ua.pt" \
        --username="technician" \
        --password="$ADMIN_PASS" \
        --no-interaction
        
    echo "Admin created successfully!"
    echo "Username: technician"
    echo "Password: $ADMIN_PASS"
else
    echo "Admin account already exists ($USER_COUNT users found)."
fi

# 5. Generate Personal Access Client if missing
echo "Checking personal access client..."
CLIENT_EXISTS=$(docker exec "$CONTAINER_NAME" php artisan tinker --execute="echo Laravel\Passport\Client::where('personal_access_client', 1)->count();" | tr -d '\r\n')
CLIENT_EXISTS=$(echo "$CLIENT_EXISTS" | grep -oE '[0-9]+' | head -n 1)

if [ -z "$CLIENT_EXISTS" ] || [ "$CLIENT_EXISTS" -eq 0 ]; then
    echo "Creating Laravel Passport personal access client..."
    docker exec "$CONTAINER_NAME" php artisan passport:client --personal --no-interaction
else
    echo "Personal access client already exists."
fi

# 6. Generate Personal Access Token
echo "Generating API token..."
TOKEN_OUTPUT=$(docker exec "$CONTAINER_NAME" php artisan tinker --execute="echo App\Models\User::first()->createToken('BootstrapToken')->accessToken;")
# Clean up token output to make sure it contains only the JWT string
TOKEN=$(echo "$TOKEN_OUTPUT" | tr -d '\r\n' | grep -oE 'eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+')

if [ -z "$TOKEN" ]; then
    echo "ERROR: Failed to generate Snipe-IT API Token."
    exit 1
fi

echo "API Token generated successfully!"

# 7. Update environment variables in apps/api/.env
ENV_FILE="$PROJECT_ROOT/apps/api/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Warning: apps/api/.env file does not exist. Creating from example..."
    cp "$PROJECT_ROOT/apps/api/.env.example" "$ENV_FILE"
fi

# Update or insert SNIPEIT_API_TOKEN in .env
if grep -q "SNIPEIT_API_TOKEN=" "$ENV_FILE"; then
    # Escape token for sed
    ESCAPED_TOKEN=$(echo "$TOKEN" | sed 's/[&/\]/\\&/g')
    # Use different sed options depending on OS (Linux vs macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|SNIPEIT_API_TOKEN=.*|SNIPEIT_API_TOKEN=$ESCAPED_TOKEN|" "$ENV_FILE"
    else
        sed -i "s|SNIPEIT_API_TOKEN=.*|SNIPEIT_API_TOKEN=$ESCAPED_TOKEN|" "$ENV_FILE"
    fi
else
    echo "" >> "$ENV_FILE"
    echo "SNIPEIT_API_TOKEN=$TOKEN" >> "$ENV_FILE"
fi

echo "Updated SNIPEIT_API_TOKEN in $ENV_FILE"

# 8. Restart API container
echo "Restarting API service to load the new token..."
docker compose -f "$PROJECT_ROOT/infra/docker/docker-compose.yml" up -d --build api

echo "--------------------------------------------------"
echo "Snipe-IT Bootstrapping Completed Successfully!"
echo "--------------------------------------------------"
