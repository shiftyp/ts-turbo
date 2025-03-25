declare module 'idiomorph' {
  interface IdiomorphOptions {
    morphStyle?: 'innerHTML' | 'outerHTML';
    callbacks?: any;
    [key: string]: any;
  }

  export const Idiomorph: {
    morph(
      currentElement: Element | Node | NodeListOf<ChildNode>,
      newElement: Element | Node | NodeListOf<ChildNode>,
      options?: IdiomorphOptions
    ): void;
  };
}
