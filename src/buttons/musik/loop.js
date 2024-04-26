const { EmbedBuilder, ApplicationCommandType } = require("discord.js");
  
/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "loop",
  description: "loop",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    // const type = interaction.options.getString("type") || "track";
    const type = "track";
    const response = toggleLoop(interaction, type);
    await interaction.update(response);
  },
};
  
/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 * @param {"queue"|"track"} type
 */
function toggleLoop({ client, guildId }, type) {
    const player = client.lavalink.getPlayer(guildId);

    const embedLoop = new EmbedBuilder()
      .setColor(client.config.EMBED_COLORS.BOT_EMBED)
      .setAuthor({name: "Loop Mode"})
  

    switch (player.repeatMode) {
        case "off":
          player.setRepeatMode("queue");
          embedLoop.setDescription("Loop Mode is set to `queue`");
          return { embeds: [embedLoop] };

        case "queue":
          player.setRepeatMode("track");
          embedLoop.setDescription("Loop Mode is set to `track`");
          return { embeds: [embedLoop] };

        case "track":
          player.setRepeatMode("off");
          embedLoop.setDescription("Loop Mode is set to `off`");
          return { embeds: [embedLoop] };
      }
  }