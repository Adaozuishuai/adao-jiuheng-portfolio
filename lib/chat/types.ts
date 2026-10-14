export type Source = { id: number; title: string; href: string };
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  interrupted?: boolean;
};
