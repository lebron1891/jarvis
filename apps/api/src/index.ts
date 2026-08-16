import http from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { notify } from "./services/notifications";
import { initSockets } from "./sockets";

const app = createApp();
const server = http.createServer(app);
initSockets(server);

/**
 * Session reminders: every minute, notify both participants of confirmed
 * bookings starting within the next hour that haven't been reminded yet.
 */
async function sendDueReminders() {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const due = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startsAt: { gte: now, lte: inOneHour },
    },
    include: {
      userSkill: { include: { skill: true } },
      teacher: { select: { name: true } },
      student: { select: { name: true } },
    },
  });
  for (const booking of due) {
    const when = booking.startsAt.toISOString();
    await notify(
      booking.teacherId,
      "BOOKING",
      "Upcoming session ⏰",
      `You teach ${booking.userSkill.skill.name} to ${booking.student.name} within the hour.`,
      { bookingId: booking.id, startsAt: when },
    );
    await notify(
      booking.studentId,
      "BOOKING",
      "Upcoming session ⏰",
      `Your ${booking.userSkill.skill.name} lesson with ${booking.teacher.name} starts within the hour.`,
      { bookingId: booking.id, startsAt: when },
    );
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: now },
    });
  }
}

setInterval(() => {
  sendDueReminders().catch((err) => console.error("reminder job failed", err));
}, 60_000);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 SkillSwap API listening on http://localhost:${env.PORT}`);
});
