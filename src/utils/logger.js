const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, colorize, errors } = format;
const path = require("path");

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const loggerTransports = [new transports.Console()];

if (process.env.NODE_ENV !== "production") {
  loggerTransports.push(
    new transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
    }),
    new transports.File({
      filename: path.join("logs", "combined.log"),
    })
  );
}

const logger = createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: combine(
    colorize(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat
  ),
  transports: loggerTransports,
  exceptionHandlers:
    process.env.NODE_ENV !== "production"
      ? [new transports.File({ filename: path.join("logs", "exceptions.log") })]
      : [],
  rejectionHandlers:
    process.env.NODE_ENV !== "production"
      ? [new transports.File({ filename: path.join("logs", "rejections.log") })]
      : [],
});

// Handle uncaught exceptions outside of Winston
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

module.exports = logger;
