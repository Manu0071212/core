FROM node:20

# Build-time arguments for deployment URL configuration.
# These must be set in docker-compose.yml (build.args) and are baked into the
# Next.js bundle at build time because NEXT_PUBLIC_* vars are inlined by the compiler.
#
# NEXT_PUBLIC_BASE_PATH    — Path prefix for the app, e.g. /new or empty string.
# NEXT_PUBLIC_API_URL      — Full path prefix to the API as seen by the browser.
#                            Must equal NGINX_API_PATH in docker-compose.yml.
#                            e.g. /new/api (with prefix) or /api (root deployment)
# NEXT_PUBLIC_SNIPEIT_URL  — Public Snipe-IT URL for the sidebar link.
ARG NEXT_PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_API_URL="/api"
ARG NEXT_PUBLIC_SNIPEIT_URL=""

# Expose as environment variables so Next.js can read them during `npm run build`
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SNIPEIT_URL=$NEXT_PUBLIC_SNIPEIT_URL

WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install -g pnpm
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]