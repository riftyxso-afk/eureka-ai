import { z } from "zod";
export const meetInput = z.object({
 action: z.enum(["create","resolve","join","signal","chat","board","stroke","ai","leave","voice","screen","tutor-state","board-save","tutor-question"]),
 content:z.string().max(60000).optional(),original:z.string().max(60000).optional(),
 phase:z.enum(['idle','permission','connecting','listening','thinking','searching','working','speaking']).optional(),
 code:z.string().regex(/^[A-Fa-f0-9]{12}$/).optional(), provider:z.enum(['momo','lala']).nullable().optional(),
 roomId: z.string().uuid().optional(), clientId: z.string().uuid().optional(),
 title: z.string().trim().min(3).max(100).optional(), invite: z.string().regex(/^[a-f0-9]{48}$/).optional(),
 recipient: z.string().uuid().optional(), text: z.string().trim().max(6000).optional(), open: z.boolean().optional(),
 signal: z.object({ description: z.object({ type:z.enum(["offer","answer"]),sdp:z.string().max(30000) }).optional(), candidate: z.object({candidate:z.string().max(2000),sdpMid:z.string().nullable().optional(),sdpMLineIndex:z.number().nullable().optional(),usernameFragment:z.string().nullable().optional()}).optional() }).optional(),
 points: z.array(z.tuple([z.number().min(0).max(1),z.number().min(0).max(1)])).min(2).max(300).optional(),
});
export type MeetMember = { id:string; name:string; user_id:string };
export type MeetEvent = { id:number; sender:string; kind:string; payload:Record<string, unknown> };
