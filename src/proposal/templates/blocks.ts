/** 中性提案块注册表。不编造公司名或品牌色。 */

export type TemplateBlockType =
  | "cover"
  | "understanding"
  | "creative"
  | "concept"
  | "style"
  | "cases"
  | "storyboard"
  | "process"
  | "quote"
  | "schedule";

export const TEMPLATE_BLOCKS: Array<{
  type: TemplateBlockType;
  label: string;
  defaultTitle: string;
}> = [
  { type: "cover", label: "封面", defaultTitle: "封面" },
  { type: "understanding", label: "需求理解", defaultTitle: "需求理解" },
  { type: "creative", label: "创意", defaultTitle: "创意" },
  { type: "concept", label: "创意", defaultTitle: "创意" },
  { type: "style", label: "视觉风格", defaultTitle: "视觉风格" },
  { type: "cases", label: "案例", defaultTitle: "案例" },
  { type: "storyboard", label: "分镜参考", defaultTitle: "分镜参考" },
  { type: "process", label: "制作流程", defaultTitle: "制作流程" },
  { type: "quote", label: "报价", defaultTitle: "报价" },
  { type: "schedule", label: "排期", defaultTitle: "排期" },
];

export const CUSTOMER_FORBIDDEN_MARKERS = [
  "成本",
  "利润",
  "内部备注",
  "任务清单",
  "cost-note",
  "profit-",
  "internal-note",
  "work-task",
] as const;
