const { EmbedBuilder } = require("discord.js");
const { getUser } = require("@schemas/User");
const { diffHours, getRemainingTime } = require("@helpers/Utils");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "daily",
  description: "receive a daily bonus",
  category: "ECONOMY",
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
  },
  slashCommand: {
    enabled: true,
  },

  async messageRun(message, args) {
    const response = await daily(message.author);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await daily(interaction);
    await interaction.followUp(response);
  },
};

async function daily(interaction) {
  const userDb = await getUser(interaction.user);
  let streak = 0;

  if (userDb.daily.timestamp) {
    const lastUpdated = new Date(userDb.daily.timestamp);
    const difference = diffHours(new Date(), lastUpdated);
    if (difference < 24) {
      const nextUsage = lastUpdated.setHours(lastUpdated.getHours() + 24);
      return `You can again run this command in \`${getRemainingTime(nextUsage)}\``;
    }
    streak = userDb.daily.streak || streak;
    if (difference < 48) streak += 1;
    else streak = 0;
  }

  userDb.daily.streak = streak;
  userDb.coins += client.config.ECONOMY.DAILY_COINS;
  userDb.daily.timestamp = new Date();
  await userDb.save();

  const embed = new EmbedBuilder()
    .setColor(client.config.EMBED_COLORS.BOT_EMBED)
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
    .setDescription(
      `You got ${client.config.ECONOMY.DAILY_COINS}${client.config.ECONOMY.CURRENCY} as your daily reward\n` +
        `**Updated Balance:** ${userDb.coins}${client.config.ECONOMY.CURRENCY}`
    );

  return { embeds: [embed] };
}
