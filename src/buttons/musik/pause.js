const { EmbedBuilder, ApplicationCommandType } = require("discord.js");
  
/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "pause",
  description: "pause",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    const response = pause(interaction);
    await interaction.update(response);
  },
};
  
/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 */
function pause({ client, guildId }) {
    const player = client.lavalink.getPlayer(guildId);
    const embedPauseResume = new EmbedBuilder()
      .setColor(client.config.EMBED_COLORS.BOT_EMBED)
    if (player.paused) {
      player.resume();
      embedPauseResume
      .setAuthor({name: "Musik wiedergabe"})
      .setDescription("▶️ Musik wird fortgesetzt")
    return { embeds: [embedPauseResume] };
    }
  
    else if (!player.paused) {
      player.pause();
      embedPauseResume
        .setAuthor({name: "Musik pausiert"})
        .setDescription("⏸️ Musik wurde pausiert.")
      return { embeds: [embedPauseResume] };
    }
  }