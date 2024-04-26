const { ApplicationCommandType, EmbedBuilder } = require("discord.js");
  
/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "next",
  description: "next",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    const response = skip(interaction);
    await interaction.update(response);
  },
};
  
/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 */
function skip({ client, guildId }) {
  const player = client.lavalink.getPlayer(guildId);

  const embedSkip = new EmbedBuilder()

  // check if current song is playing
  if (!player.queue.current) {
    embedSkip
      .setColor(client.config.EMBED_COLORS.ERROR)
      .setAuthor({name: "Error"})
      .setDescription("🚫 There is no song currently being played")
    return { embeds: [embedSkip] };
  }

  const { title } = player.queue.current.info;
  const nextTrack = player.queue.tracks[0];

  embedSkip
      .setColor(client.config.EMBED_COLORS.ERROR)
      .setAuthor({name: "Skip Song"})
  

  if(!nextTrack) {
    embedSkip.setDescription("⏯️ There is no song to skip.");
    return { embeds: [embedSkip] };
  }
  
  player.skip(0);
  embedSkip.setDescription(`⏯️ ${title} was skipped.`);

  return { embeds: [embedSkip] };  
}