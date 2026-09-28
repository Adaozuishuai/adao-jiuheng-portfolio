export const projects = [
  {
    id: 'interface',
    title: '界面与体验',
    category: '产品设计',
    year: '2026',
    mark: 'UI',
    tone: 'stone',
  },
  {
    id: 'agents',
    title: '人与智能体',
    category: '交互实验',
    year: '2025',
    mark: 'AI',
    tone: 'slate',
  },
  {
    id: 'practice',
    title: '未命名练习',
    category: '视觉研究',
    year: '2025',
    mark: 'LAB',
    tone: 'sand',
  },
  {
    id: 'systems',
    title: '信息与秩序',
    category: '视觉研究',
    year: '2025',
    mark: 'SYS',
    tone: 'silver',
  },
];

export type ProjectVisual = {
  src?: string;
  alt: string;
  label: string;
  detail: string;
  position?: string;
  mobilePosition?: string;
};

export const projectVisuals: Record<string, ProjectVisual> = {
  interface: {
    src: '/images/home/interface.webp',
    alt: '日光下的半透明界面层与深色球体，界面设计概念视觉',
    label: 'UI & EXPERIENCE',
    detail: 'PRODUCT DESIGN',
  },
  agents: {
    position: '50% 38%',
    mobilePosition: '58% 45%',
    src: '/images/home/agents.webp',
    alt: '蓝灰色背景中的人像雕塑与细线轨道，人机交互概念视觉',
    label: 'HUMANS × AI',
    detail: 'INTERACTION EXPERIMENT',
  },
  practice: {
    src: '/images/home/practice.webp',
    alt: '砂色与陶土色球场上的几何线条，视觉研究概念图',
    label: 'VISUAL RESEARCH',
    detail: 'EXPLORATION',
  },
  systems: {
    alt: '银灰色 SYS 信息与秩序概念视觉',
    label: 'INFORMATION & ORDER',
    detail: 'VISUAL RESEARCH',
  },
};
