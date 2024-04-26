const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "invitecodes",
  description: "list all your invites codes in this guild",
  category: "INVITE",
  botPermissions: ["EmbedLinks", "ManageGuild"],
  command: {
    enabled: true,
    usage: "[@member|id]",
  },
  slashCommand: {
    enabled: false,
    options: [
      {
        name: "user",
        description: "the user to get the invite codes for",
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],
  },

  async messageRun(message, args) {
    const target = (await message.guild.resolveMember(args[0])) || message.member;
    const response = await getInviteCodes(message, target.user);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const response = await getInviteCodes(interaction, user);
    await interaction.followUp(response);
  },
};

async function getInviteCodes({ client, guild }, user) {
  const invites = await guild.invites.fetch({ cache: false });
  const reqInvites = invites.filter((inv) => inv.inviter.id === user.id);
  if (reqInvites.size === 0) return `\`${user.username}\` has no invites in this server`;

  let str = "";
  reqInvites.forEach((inv) => {
    str += `❯ [${inv.code}](${inv.url}) : ${inv.uses} uses\n`;
  });

  const embed = new EmbedBuilder()
    .setAuthor({ name: `Invite code for ${user.username}` })
    .setColor(client.config.EMBED_COLORS.BOT_EMBED)
    .setDescription(str);

  return { embeds: [embed] };
}
