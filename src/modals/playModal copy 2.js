const {
    ApplicationCommandType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");
const prettyMs = require("pretty-ms");
const { EMBED_COLORS, MUSIC } = require("@root/config");
const { SpotifyItemType } = require("@lavaclient/spotify");

const search_prefix = {
  YT: "ytsearch",
  YTM: "ytmsearch",
  SC: "scsearch",
};


/**
* @type {import("@structures/BaseModal")}
*/
module.exports = {
    id: "playModal22",
    description: "Play Modal",
    type: ApplicationCommandType.User,
    enabled: true,
    ephemeral: false,
    options: true,
    userPermissions: [],
    cooldown: 0,
  
    async run(interaction) {
      const musicNameOrLink = interaction.fields.getTextInputValue('playInput');
      const response = await play(interaction, musicNameOrLink);
      await interaction.update(response); 
    },
};
  

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 * @param {string} query
 */
async function play(interaction, query) {
  const vcId = interaction.member?.voice?.channelId;
  // create player
  const player = interaction.client.lavalink.getPlayer(interaction.guildId) || await interaction.client.lavalink.createPlayer({
      guildId: interaction.guildId, 
      voiceChannelId: vcId, 
      textChannelId: interaction.channelId, 
      selfDeaf: true, 
      selfMute: false,
      volume: 100,  // default volume
      instaUpdateFiltersFix: true, // optional
      applyVolumeAsFilter: false, // if true player.setVolume(54) -> player.filters.setVolume(0.54)
      // node: "YOUR_NODE_ID",
      // vcRegion: (interaction.member as GuildMember)?.voice.channel?.rtcRegion!
  }); 


  const connected = player.connected;

  if(!connected) await player.connect();

  // search a query (query-search, url search, identifier search, etc.)
  const res = await player.search({
      query: query,
      // source: `Spotify`,
  }, interaction.user); 

  switch (res.loadType) {
    case "LOAD_FAILED":
      guild.client.logger.error("Search Exception", res.exception);
      const embedSearchError = new EmbedBuilder()
        .setColor(client.config.EMBED_COLORS.ERROR)
        .setAuthor({name: "Error"})
        .setDescription("🚫 There was an error while searching")
      return { embeds: [embedSearchError] };

    case "NO_MATCHES":
      const embedNoResultsError = new EmbedBuilder()
        .setColor(client.config.EMBED_COLORS.ERROR)
        .setAuthor({name: "Error"})
        .setDescription(`No results found matching ${query}`)
      return { embeds: [embedNoResultsError] };

    case "PLAYLIST_LOADED":
      tracks = res.tracks;
      description = res.playlistInfo.name;
      break;

    case "TRACK_LOADED":
    case "SEARCH_RESULT": {
      const [track] = res.tracks;
      tracks = [track];
      break;
    }

    default:
      guild.client.logger.debug("Unknown loadType", res);
      return { embeds: [embedDefaultCaseError] };
  }

  if (!tracks) guild.client.logger.debug({ query, res });

  // add the first result
  await player.queue.add(res.tracks[0]); 

  

  // only play if the player isn't playing something, 
  // if(!player.playing) await player.play(); // you can provide a specific track, or let the manager choose the track from the queue!
  if(!player.playing) await player.play(connected ? { volume: 100, paused: false } : undefined);

  console.log(res);
  console.log(res.loadtype);
  }
  