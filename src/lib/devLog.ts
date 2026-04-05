export const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

export const devCount = (label: string) => {
  if (import.meta.env.DEV) console.count(label);
};

export const devWarn = (...args: any[]) => {
  if (import.meta.env.DEV) console.warn(...args);
};

export const devError = (...args: any[]) => {
  if (import.meta.env.DEV) console.error(...args);
};
