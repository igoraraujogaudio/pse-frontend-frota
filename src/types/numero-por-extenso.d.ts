declare module 'numero-por-extenso' {
  interface ExtensoOptions {
    mode?: 'number' | 'currency';
    currency?: {
      type?: 'BRL' | 'USD' | 'EUR';
      position?: 'before' | 'after';
    };
  }

  function extenso(value: number | string, options?: ExtensoOptions): string;
  
  export = extenso;
} 