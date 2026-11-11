export type StudySource = {
  kind: "web" | "video" | "paper";
  title: string;
  url: string;
  excerpt: string;
  byline?: string;
  publishedAt?: string;
};

export type StudySeries = {
  code: string;
  name: string;
  points: { date: string; close: number }[];
};

export type StudyFeedback = { feedback: string; question: string };

export type ResearchProject = { id: string; title: string; owner_id: string };
export type ResearchPaper = { id: string; title: string; url: string; excerpt: string; assigned_to: string | null };
export type ResearchGroup = {
  project: ResearchProject;
  members: { id: string; name: string }[];
  papers: ResearchPaper[];
  viewer: string;
  friends: { id: string; name: string }[];
};
