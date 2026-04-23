# Deployment Guide (MERN Stack on Ubuntu)

This guide provides step-by-step instructions to deploy the TVETMARA Besut Dashboard (MERN Stack) on an Ubuntu server.

## 1. System Update & Prerequisites
First, update your package manager and upgrade existing packages.
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git build-essential nginx -y
```

## 2. Install Node.js & npm (via NodeSource)
Install Node.js (Version 20.x is recommended for modern Vite/React apps).
```bash
# Fetch and install Node.js setup script
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node -v
npm -v
```

## 3. Install MongoDB
If your application uses a local MongoDB database, install it using the official repository.
*(Note: If you use MongoDB Atlas, you can skip this step and just provide your connection string in `.env`)*

```bash
# Import the public key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Create a list file for MongoDB
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Reload local package database and install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```

## 4. Setup the Project
Clone your repository or upload your project files to the `/var/www` directory.

```bash
# Create directory
sudo mkdir -p /var/www/ikmb-dashboard
sudo chown -R $USER:$USER /var/www/ikmb-dashboard

# Navigate to the directory
cd /var/www/ikmb-dashboard

# (Optional) Clone from Git如果 applicable
# git clone <your-repo-url> .
```

## 5. Install Dependencies & Build Frontend
Install all required Node.js packages and build the React (Vite) frontend for production.

```bash
# Install dependencies
npm install

# Build the Vite React Frontend
npm run build
```

## 6. Configure Environment Variables
Create a `.env` file in the root of the project folder. Ensure it contains the necessary variables for Express and Mongoose.

```bash
nano .env
```
*Example `.env`:*
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/ikmb_db
```

## 7. Start the Server with PM2
PM2 is a production process manager for Node.js apps that keeps them alive forever.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the Express server
pm2 start server.js --name "ikmb-api"

# Save PM2 process list to restart automatically on server boot
pm2 save
pm2 startup
```

## 8. Configure Nginx (Reverse Proxy)
To access the API or the static frontend cleanly via port 80 (HTTP), set up Nginx.

```bash
sudo nano /etc/nginx/sites-available/ikmb-dashboard
```

**Paste the following configuration:**
```nginx
server {
    listen 80;
    server_name your_domain_or_IP;

    # Serve built React files if server.js serves API only
    # (If server.js handles both API + static files, just proxy everything)
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable the site and restart Nginx:**
```bash
# Enable the configuration
sudo ln -s /etc/nginx/sites-available/ikmb-dashboard /etc/nginx/sites-enabled/

# Test Nginx syntax
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Troubleshooting
- **Check Server Logs:** `pm2 logs ikmb-api`
- **Restart Server:** `pm2 restart ikmb-api`
- **Check MongoDB Logs:** `sudo journalctl -u mongod`
