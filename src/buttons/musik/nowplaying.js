const { EmbedBuilder, ApplicationCommandType } = require("discord.js");
const prettyMs = require("pretty-ms");
const { splitBar } = require("string-progressbar");
  
/**
* @type {import("@structures/BaseButton")}
*/
module.exports = {
  id: "nowplaying",
  description: "nowplaying",
  type: ApplicationCommandType.User,
  category: "MUSIC",
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    const response = nowPlaying(interaction);
    await interaction.update(response);
  },
};
  
/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 */
function nowPlaying({ client, guildId }) {
  const player = client.lavalink.getPlayer(guildId);
  if (!player || !player.queue.current) {
    const embedNoMusic = new EmbedBuilder()
      .setColor(client.config.EMBED_COLORS.ERROR)
      .setAuthor({name: "Error"})
      .setDescription("🚫 No music is being played!")
    return { embeds: [embedNoMusic] };
  }

  
  const track = player.queue.current;
  const end = track.info.duration > 6.048e8 ? "🔴 LIVE" : new Date(track.info.duration).toISOString().slice(11, 19);

  const embed = new EmbedBuilder()
    .setColor(client.config.EMBED_COLORS.BOT_EMBED)
    .setAuthor({ name: "Now playing" })
    .setDescription(`[${track.info.title}](${track.info.uri})`)
    .addFields(
      {
        name: "Song Duration",
        value: "`" + prettyMs(track.info.duration, { colonNotation: true }) + "`",
        inline: true,
      },
      {
        name: "Requested By",
        value: track.requester.username || "Unknown",
        inline: true,
      },
      {
        name: "\u200b",
        value:
          new Date(player.position).toISOString().slice(11, 19) +
          " [" +
          splitBar(track.info.duration > 6.048e8 ? player.position : track.info.duration, player.position, 15)[0] +
          "] " +
          end,
        inline: false,
      }
    );

  return { embeds: [embed] };
}
