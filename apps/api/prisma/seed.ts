/**
 * Seeds the database with categories, skills, badges, challenges and demo
 * accounts. Idempotent: safe to run multiple times.
 *
 *   npm run db:seed --workspace apps/api
 *
 * Demo accounts (password for all): "Password123!"
 *   admin@skillswap.app  — administrator
 *   maya@skillswap.app   — designer teaching Figma
 *   liam@skillswap.app   — developer teaching TypeScript
 *   sofia@skillswap.app  — polyglot teaching Spanish
 *   kenji@skillswap.app  — pianist teaching music theory
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.DATABASE_URL ??=
  "postgresql://skillswap:skillswap@localhost:5432/skillswap";

const prisma = new PrismaClient();

const CATEGORIES: Array<{ name: string; icon: string; skills: string[] }> = [
  { name: "Programming", icon: "code", skills: ["TypeScript", "Python", "React", "Node.js", "Rust", "SQL"] },
  { name: "Design", icon: "palette", skills: ["Figma", "UI Design", "Illustration", "Branding"] },
  { name: "Business", icon: "briefcase", skills: ["Entrepreneurship", "Accounting", "Public Speaking"] },
  { name: "Marketing", icon: "megaphone", skills: ["SEO", "Content Marketing", "Social Media"] },
  { name: "Languages", icon: "languages", skills: ["English", "Spanish", "French", "Japanese", "German"] },
  { name: "Music", icon: "music", skills: ["Piano", "Guitar", "Music Theory", "Singing"] },
  { name: "Sports", icon: "dumbbell", skills: ["Tennis", "Running", "Swimming"] },
  { name: "Cooking", icon: "chef-hat", skills: ["Italian Cuisine", "Baking", "Sushi"] },
  { name: "Photography", icon: "camera", skills: ["Portrait Photography", "Lightroom", "Street Photography"] },
  { name: "Video Editing", icon: "clapperboard", skills: ["Premiere Pro", "DaVinci Resolve", "After Effects"] },
  { name: "AI", icon: "bot", skills: ["Prompt Engineering", "Machine Learning", "LLM Apps"] },
  { name: "Mathematics", icon: "sigma", skills: ["Calculus", "Linear Algebra", "Statistics"] },
  { name: "Science", icon: "flask-conical", skills: ["Physics", "Chemistry", "Biology"] },
  { name: "Fitness", icon: "heart-pulse", skills: ["Yoga", "Strength Training", "Nutrition"] },
  { name: "Personal Development", icon: "sprout", skills: ["Productivity", "Meditation", "Career Coaching"] },
];

const BADGES = [
  { code: "FIRST_EXCHANGE", name: "First Exchange", description: "Complete your first skill exchange", icon: "handshake", tier: 1 },
  { code: "EXCHANGE_10", name: "Regular", description: "Complete 10 exchanges", icon: "repeat", tier: 2 },
  { code: "EXCHANGE_50", name: "Veteran", description: "Complete 50 exchanges", icon: "medal", tier: 3 },
  { code: "MENTOR", name: "Mentor", description: "Teach 10 sessions", icon: "graduation-cap", tier: 2 },
  { code: "SCHOLAR", name: "Scholar", description: "Learn 10 sessions", icon: "book-open", tier: 2 },
  { code: "STREAK_7", name: "On Fire", description: "Keep a 7-day streak", icon: "flame", tier: 1 },
  { code: "STREAK_30", name: "Unstoppable", description: "Keep a 30-day streak", icon: "zap", tier: 3 },
  { code: "POLYGLOT", name: "Polyglot", description: "Speak 3 or more languages", icon: "languages", tier: 2 },
  { code: "TOP_RATED", name: "Top Rated", description: "Maintain a 4.8+ rating over 10 reviews", icon: "star", tier: 3 },
  { code: "VERIFIED", name: "Verified Teacher", description: "Pass teacher verification", icon: "badge-check", tier: 2 },
  { code: "EARLY_ADOPTER", name: "Early Adopter", description: "Joined during the launch period", icon: "rocket", tier: 1 },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function main() {
  console.log("🌱 Seeding SkillSwap…");

  // Categories + skills
  const skillIds = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: slugify(cat.name) },
      create: { name: cat.name, slug: slugify(cat.name), icon: cat.icon },
      update: { icon: cat.icon },
    });
    for (const skillName of cat.skills) {
      const skill = await prisma.skill.upsert({
        where: { slug: slugify(skillName) },
        create: { name: skillName, slug: slugify(skillName), categoryId: category.id },
        update: {},
      });
      skillIds.set(skillName, skill.id);
    }
  }
  console.log(`  ✓ ${CATEGORIES.length} categories`);

  // Badges
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      create: badge,
      update: badge,
    });
  }
  console.log(`  ✓ ${BADGES.length} badges`);

  // Weekly challenges
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 3600_000);
  const challenges = [
    { code: "WEEKLY_TEACH_3", title: "Share the knowledge", description: "Teach 3 sessions this week", metric: "sessions_taught", target: 3, xpReward: 150 },
    { code: "WEEKLY_LEARN_2", title: "Stay curious", description: "Complete 2 lessons this week", metric: "sessions_learned", target: 2, xpReward: 100 },
    { code: "WEEKLY_REVIEW_3", title: "Give back", description: "Write 3 reviews this week", metric: "reviews_written", target: 3, xpReward: 75 },
  ];
  for (const c of challenges) {
    await prisma.challenge.upsert({
      where: { code: c.code },
      create: { ...c, startsAt: now, endsAt: weekFromNow },
      update: { endsAt: weekFromNow },
    });
  }
  console.log(`  ✓ ${challenges.length} challenges`);

  // Demo users
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const demoUsers: Array<{
    email: string;
    username: string;
    name: string;
    role?: "ADMIN";
    country: string;
    languages: string[];
    verifiedTeacher?: boolean;
    bio: string;
    credits: number;
    teach?: Array<[string, string]>;
    learn?: string[];
    xp?: number;
  }> = [
    {
      email: "admin@skillswap.app", username: "admin", name: "SkillSwap Admin",
      role: "ADMIN", country: "France", languages: ["English", "French"],
      bio: "Platform administrator.", credits: 10,
    },
    {
      email: "maya@skillswap.app", username: "maya", name: "Maya Chen",
      country: "Canada", languages: ["English", "Mandarin"], verifiedTeacher: true,
      bio: "Product designer with 8 years of experience. I teach Figma and UI design, and I want to learn Spanish.",
      credits: 12, teach: [["Figma", "Design systems & prototyping"], ["UI Design", "From wireframe to polish"]],
      learn: ["Spanish"], xp: 2400,
    },
    {
      email: "liam@skillswap.app", username: "liam", name: "Liam O'Brien",
      country: "Ireland", languages: ["English"], verifiedTeacher: true,
      bio: "Full-stack developer. TypeScript evangelist. Trading code lessons for piano lessons!",
      credits: 8, teach: [["TypeScript", "Types that scale"], ["React", "Hooks, patterns, performance"], ["Node.js", "APIs & tooling"]],
      learn: ["Piano"], xp: 3100,
    },
    {
      email: "sofia@skillswap.app", username: "sofia", name: "Sofía García",
      country: "Spain", languages: ["Spanish", "English", "French"],
      bio: "Native Spanish speaker and language coach. ¡Hola! Looking to improve my photography.",
      credits: 15, teach: [["Spanish", "Conversational Spanish for all levels"], ["French", "Grammar without tears"]],
      learn: ["Portrait Photography"], xp: 1800,
    },
    {
      email: "kenji@skillswap.app", username: "kenji", name: "Kenji Tanaka",
      country: "Japan", languages: ["Japanese", "English"], verifiedTeacher: true,
      bio: "Conservatory-trained pianist. I teach piano and music theory, keen to learn machine learning.",
      credits: 6, teach: [["Piano", "Classical & jazz foundations"], ["Music Theory", "Hear what you play"]],
      learn: ["Machine Learning"], xp: 2050,
    },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        username: u.username,
        name: u.name,
        passwordHash,
        role: u.role ?? "USER",
        country: u.country,
        languages: u.languages,
        bio: u.bio,
        emailVerified: true,
        onboardingDone: true,
        verifiedTeacher: u.verifiedTeacher ?? false,
        creditBalance: u.credits,
        xp: u.xp ?? 0,
        level: Math.floor(Math.sqrt((u.xp ?? 0) / 100)) + 1,
        availability: {
          create: [
            { dayOfWeek: 2, startMinute: 18 * 60, endMinute: 21 * 60 },
            { dayOfWeek: 4, startMinute: 18 * 60, endMinute: 21 * 60 },
            { dayOfWeek: 6, startMinute: 10 * 60, endMinute: 16 * 60 },
          ],
        },
      },
      update: {},
    });

    if ((await prisma.creditTransaction.count({ where: { userId: user.id } })) === 0) {
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          amount: u.credits,
          balanceAfter: u.credits,
          type: "SIGNUP_BONUS",
          description: "Welcome bonus — book your first lessons!",
        },
      });
    }

    for (const [skillName, headline] of u.teach ?? []) {
      const skillId = skillIds.get(skillName);
      if (!skillId) continue;
      await prisma.userSkill.upsert({
        where: { userId_skillId_kind: { userId: user.id, skillId, kind: "TEACH" } },
        create: { userId: user.id, skillId, kind: "TEACH", headline, yearsOfExp: 5, mode: "ONLINE" },
        update: {},
      });
    }
    for (const skillName of u.learn ?? []) {
      const skillId = skillIds.get(skillName);
      if (!skillId) continue;
      await prisma.userSkill.upsert({
        where: { userId_skillId_kind: { userId: user.id, skillId, kind: "LEARN" } },
        create: { userId: user.id, skillId, kind: "LEARN" },
        update: {},
      });
    }

    const earlyAdopter = await prisma.badge.findUnique({ where: { code: "EARLY_ADOPTER" } });
    if (earlyAdopter) {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: user.id, badgeId: earlyAdopter.id } },
        create: { userId: user.id, badgeId: earlyAdopter.id },
        update: {},
      });
    }
  }
  console.log(`  ✓ ${demoUsers.length} demo accounts (password: Password123!)`);

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
