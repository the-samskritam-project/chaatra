# Use an official Node.js runtime as a parent image
FROM node:16

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# If you're using yarn:
# COPY package.json yarn.lock ./

# Install dependencies
RUN npm install
# Or use yarn:
# RUN yarn install

# Bundle app source inside Docker image
COPY . .

# Map port 3000 to the Docker daemon to access the app
EXPOSE 3000

# Run the app using npm start
CMD ["npm", "start"]
# Or use yarn:
# CMD ["yarn", "start"]
