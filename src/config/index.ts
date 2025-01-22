import dotenv from "dotenv";

/**
 * Load environment variables from a `.env` file.
 */
dotenv.config();

/**
 * The port number on which the server will listen.
 * 
 * This constant retrieves the port number from the environment variable `PORT`.
 * If the `PORT` environment variable is not set, it defaults to `3000`.
 * 
 * @constant {number} PORT - The port number for the server.
 */
export const PORT: number = parseInt(process.env["PORT"] ?? "3000", 10);

/**
 * The base URL for the application, which is determined by the `BASE_URL` environment variable.
 * If the `BASE_URL` environment variable is not set, it defaults to `http://localhost:${PORT}`.
 */
export const BASE_URL: string = process.env["BASE_URL"] ?? `http://localhost:${PORT}`;

/**
 * The file path for storing URLs.
 * 
 * This constant retrieves the file path from the environment variable `URLS_FILE`.
 * If the environment variable is not set, it defaults to "urls.json".
 * 
 * @constant {string} URLS_FILE - The file path for storing URLs.
 */
export const URLS_FILE: string = "./data/" + (process.env["URLS_FILE"] ?? "urls.json");

/**
 * The path to the messages file.
 * 
 * This constant retrieves the path from the environment variable `MESSAGES_FILE`.
 * If the environment variable is not set, it defaults to "messages.json".
 * 
 * @constant {string} MESSAGES_FILE - The path to the messages file.
 */
export const MESSAGES_FILE: string = "./data/" + (process.env["MESSAGES_FILE"] ?? "messages.json");


/**
 * The maximum age of a message in milliseconds.
 * 
 * This value is retrieved from the environment variable `MAX_MESSAGE_AGE_MS`.
 * If the environment variable is not set, it defaults to 604800000 milliseconds (7 days).
 * 
 * @constant
 * @type {number}
 */
export const MAX_MESSAGE_AGE_MS: number = parseInt(process.env["MAX_MESSAGE_AGE_MS"] ?? "604800000", 10);

/**
 * The maximum number of delivery attempts for a given process.
 * 
 * This value is retrieved from the environment variable `MAX_DELIVERY_ATTEMPTS`.
 * If the environment variable is not set, it defaults to 10.
 * 
 * @constant
 * @type {number}
 */
export const MAX_DELIVERY_ATTEMPTS: number = parseInt(process.env["MAX_DELIVERY_ATTEMPTS"] ?? "10", 10);
