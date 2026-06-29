/**
 * Structured logger with colored CLI output.
 *
 * All scripts should use this logger rather than raw console.log.
 * Colors are applied via ANSI escape codes when stdout is a TTY.
 */

const isTTY = process.stdout.isTTY === true;

const C = {
  reset: isTTY ? '\x1b[0m' : '',
  green: isTTY ? '\x1b[32m' : '',
  red: isTTY ? '\x1b[31m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  bold: isTTY ? '\x1b[1m' : '',
};

export type Logger = ReturnType<typeof createLogger>;

/**
 * Create a tagged logger.
 */
export function createLogger(name: string) {
  const tag = `${C.dim}[${name}]${C.reset}`;

  function raw(level: string, color: string, ...args: unknown[]): void {
    const prefix = `${color}${level}${C.reset}`;
    console.log(`${tag} ${prefix}`, ...args);
  }

  return {
    info: (...args: unknown[]) => raw('ℹ', C.cyan, ...args),
    warn: (...args: unknown[]) => raw('⚠', C.yellow, ...args),
    error: (...args: unknown[]) => raw('✘', C.red, ...args),
    success: (...args: unknown[]) => raw('✔', C.green, ...args),

    /** Print a section header. */
    header(title: string): void {
      const padded = `   ${title}   `;
      const line = C.bold + '='.repeat(Math.min(padded.length, 60)) + C.reset;
      console.log(`\n${line}`);
      console.log(`${C.bold}${padded}${C.reset}`);
      console.log(`${line}\n`);
    },

    /** Print a labelled field with value. */
    field(label: string, value: string | number | bigint): void {
      console.log(`  ${C.dim}${String(label).padEnd(20)}${C.reset} ${value}`);
    },

    /** Print a key-value where both parts are formatted. */
    kv(key: string, value: string): void {
      console.log(`  ${C.dim}${key}${C.reset}  ${value}`);
    },

    /** Print a horizontal divider. */
    divider(): void {
      console.log(`  ${C.dim}${'-'.repeat(50)}${C.reset}`);
    },

    /** Print a blank line. */
    blank(): void {
      console.log('');
    },

    /** Print a success checkmark with label. */
    pass(label: string, detail?: string): void {
      const d = detail ? ` ${C.dim}(${detail})${C.reset}` : '';
      console.log(`  ${C.green}✔${C.reset} ${label}${d}`);
    },

    /** Print a failure cross with label. */
    fail(label: string, detail?: string): void {
      const d = detail ? ` ${C.dim}(${detail})${C.reset}` : '';
      console.log(`  ${C.red}✘${C.reset} ${label}${d}`);
    },
  };
}
