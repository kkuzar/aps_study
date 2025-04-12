FROM node:18-alpine AS base

LABEL authors="kuzar"

WORKDIR /app
COPY package*.json .
COPY package-lock.json* .
COPY tsconfig.json .
COPY ./src ./src
COPY .env .env

RUN npm install
RUN npm run build


EXPOSE 4000
