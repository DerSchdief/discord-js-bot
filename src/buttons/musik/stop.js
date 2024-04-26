const { EmbedBuilder, ApplicationCommandType } = require("discord.js");
  
/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "stop",
  description: "stop",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    const response = await stop(interaction);
    await interaction.update(response);
  },
};
  
/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 */
async function stop({ client, guildId }) {
  const player = client.lavalink.getPlayer(guildId);
  // player.disconnect();
  await player.destroy("Player destroyed");
  const embedMusicStopped = new EmbedBuilder()
      .setColor(client.config.EMBED_COLORS.BOT_EMBED)
      .setAuthor({name: "Musik beendet"})
      .setDescription("🎶 Musik wurde beendet, bin dann mal weg")
  return { embeds: [embedMusicStopped] };
}