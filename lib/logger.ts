import debug from "debug"

export const logger = debug("dispotool")

export const createLogger = (namespace: string) => logger.extend(namespace)
