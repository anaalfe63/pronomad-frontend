// src/custom.d.ts (or vite-env.d.ts)

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.gif' {
  const value: string;
  export default value;
}