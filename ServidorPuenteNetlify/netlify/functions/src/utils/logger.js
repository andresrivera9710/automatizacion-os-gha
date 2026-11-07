/**
 * Logger estructurado para Automatizacion OS GHA
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};

function getTimestamp() {
    return new Date().toLocaleTimeString('es-GT', { hour12: false });
}

const logger = {
    info: (msg) => {
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}INFO:${colors.reset} ${msg}`);
    },
    success: (msg) => {
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}✓ ${msg}${colors.reset}`);
    },
    warn: (msg) => {
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}⚠ ${msg}${colors.reset}`);
    },
    error: (msg, err = null) => {
        console.error(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.red}✖ ERROR: ${msg}${colors.reset}`);
        if (err && err.stack) {
            console.error(`${colors.gray}${err.stack}${colors.reset}`);
        } else if (err) {
            console.error(`${colors.gray}${JSON.stringify(err)}${colors.reset}`);
        }
    },
    banner: (title, subtitle) => {
        console.log(`${colors.cyan}==========================================================${colors.reset}`);
        console.log(`${colors.yellow}   ${title}   ${colors.reset}`);
        if (subtitle) {
            console.log(`${colors.gray}   ${subtitle}   ${colors.reset}`);
        }
        console.log(`${colors.cyan}==========================================================${colors.reset}`);
    }
};

module.exports = logger;

