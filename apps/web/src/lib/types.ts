// API response shapes (mirrors the Express + Prisma backend).

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isCustom: boolean;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  category: Category;
}

export interface UserSkill {
  id: string;
  userId: string;
  skillId: string;
  kind: "TEACH" | "LEARN";
  headline?: string | null;
  description?: string | null;
  yearsOfExp: number;
  hourlyCredits: number;
  mode: "ONLINE" | "IN_PERSON" | "BOTH";
  active: boolean;
  skill: Skill;
}

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
}

export interface UserBadge {
  badgeId: string;
  earnedAt: string;
  badge: Badge;
}

export interface User {
  id: string;
  email?: string;
  username: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
  timezone: string;
  languages: string[];
  role?: "USER" | "MODERATOR" | "ADMIN";
  plan: "FREE" | "PREMIUM";
  premiumUntil?: string | null;
  profileTheme: string;
  emailVerified?: boolean;
  verifiedTeacher: boolean;
  twoFactorEnabled?: boolean;
  onboardingDone?: boolean;
  creditBalance: number;
  xp: number;
  level: number;
  streakCount: number;
  ratingAvg: number;
  ratingCount: number;
  completedExchanges: number;
  sessionsTaught: number;
  sessionsLearned: number;
  reliabilityScore: number;
  createdAt: string;
  skills?: UserSkill[];
  availability?: AvailabilitySlot[];
  badges?: UserBadge[];
  _count?: { followers: number; following: number };
}

export interface TeacherResult extends UserSkill {
  user: Pick<
    User,
    | "id"
    | "username"
    | "name"
    | "avatarUrl"
    | "country"
    | "languages"
    | "verifiedTeacher"
    | "level"
    | "ratingAvg"
    | "ratingCount"
    | "completedExchanges"
  >;
}

export interface Booking {
  id: string;
  teacherId: string;
  studentId: string;
  userSkillId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED";
  mode: "ONLINE" | "IN_PERSON" | "BOTH";
  startsAt: string;
  endsAt: string;
  credits: number;
  notes?: string | null;
  meetingRoomId: string;
  teacherConfirmed: boolean;
  studentConfirmed: boolean;
  userSkill: UserSkill;
  teacher: Pick<User, "id" | "username" | "name" | "avatarUrl" | "timezone">;
  student: Pick<User, "id" | "username" | "name" | "avatarUrl" | "timezone">;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  description: string;
  createdAt: string;
  booking?: { id: string; userSkill: { skill: { name: string } } } | null;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  author: Pick<User, "username" | "name" | "avatarUrl">;
  booking?: { userSkill: { skill: { name: string } } };
}

export interface MessageReaction {
  messageId: string;
  userId: string;
  emoji: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "IMAGE" | "FILE" | "VOICE";
  body?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  durationSec?: number | null;
  createdAt: string;
  deletedAt?: string | null;
  sender: Pick<User, "id" | "username" | "name" | "avatarUrl">;
  reactions: MessageReaction[];
}

export interface Conversation {
  id: string;
  updatedAt: string;
  participants: Array<
    Pick<User, "id" | "username" | "name" | "avatarUrl"> & { lastActiveAt?: string }
  >;
  lastMessage: Message | null;
  unread: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface Challenge {
  id: string;
  code: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  xpReward: number;
  creditReward: number;
  endsAt: string;
  progress: number;
  completedAt?: string | null;
}

export interface Achievement extends Badge {
  earned: boolean;
  earnedAt?: string | null;
}

export interface AdminAnalytics {
  totals: {
    users: number;
    newUsers30d: number;
    activeUsers7d: number;
    exchanges: number;
    exchanges30d: number;
    premiumUsers: number;
    openReports: number;
    messages7d: number;
    avgSessionMinutes: number;
    monthlyRevenue: number;
    retention30d: number | null;
  };
  signupsByWeek: Array<{ weekStart: string; count: number }>;
  popularSkills: Array<{ name: string; sessions: number }>;
}
