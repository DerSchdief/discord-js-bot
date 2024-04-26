const { EmbedBuilder } = require("discord.js");
const { getUser } = require("@schemas/User");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "beg",
  description: "beg from someone",
  category: "ECONOMY",
  cooldown: 21600,
  botPermissions: ["EmbedLinks"],
  command: {
    enabled: true,
  },
  slashCommand: {
    enabled: true,
  },

  async messageRun(message, args) {
    const response = await beg(message.author);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await beg(interaction);
    await interaction.followUp(response);
  },
};

async function beg(interaction) {
  let users = [
    "PewDiePie",
    "T-Series",
    "Sans",
    "RLX",
    "Pro Gamer 711",
    "Zenitsu",
    "Jake Paul",
    "Kaneki Ken",
    "KSI",
    "Naruto",
    "Mr. Beast",
    "Ur Mom",
    "A Broke Person",
    "Giyu Tomiaka",
    "Bejing Embacy",
    "A Random Asian Mom",
    "Ur Step Sis",
    "Jin Mori",
    "Sakura (AKA Trash Can)",
    "Hammy The Hamster",
    "Kakashi Sensei",
    "Minato",
    "Tanjiro",
    "ZHC",
    "The IRS",
    "Joe Mama",
  ];

  let amount = Math.floor(Math.random() * `${client.config.ECONOMY.MAX_BEG_AMOUNT}` + `${client.config.ECONOMY.MIN_BEG_AMOUNT}`);
  const userDb = await getUser(interaction.user);
  userDb.coins += amount;
  await userDb.save();

  const embed = new EmbedBuilder()
    .setColor(client.config.EMBED_COLORS.BOT_EMBED)
    .setAuthor({ name: `${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setDescription(
      `**${users[Math.floor(Math.random() * users.length)]}** donated you **${amount}** ${client.config.ECONOMY.CURRENCY}\n` +
        `**Updated Balance:** **${userDb.coins}** ${client.config.ECONOMY.CURRENCY}`
    );

  return { embeds: [embed] };
}
