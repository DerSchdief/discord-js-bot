const { Client, Guild, MessageEmbed, WebhookClient } = require("discord.js");
const { EMBED_COLORS } = require("@root/config.js");
const { registerGuild, updateGuildLeft } = require("@schemas/guild-data");
const webhookClient = new WebhookClient({ url: process.env.JOIN_LEAVE_WEBHOOK });

/**
 * @param {Client} client
 */
async function run(client) {
  client.on("guildCreate", async (guild) => {
    guild.ownerId ||= (await guild.fetchOwner({ cache: true }).catch(() => {})).id;
    const data = {
      id: guild.id,
      name: guild.name,
      ownerId: guild.owner?.user?.tag,
      memberCount: guild.memberCount,
    };
    console.log("Guild Joined: " + JSON.stringify(data));
    registerGuild(guild).then(() => sendWebhook(guild, true));
  });

  client.on("guildDelete", async (guild) => {
    guild.ownerId ||= (await guild.fetchOwner({ cache: true }).catch(() => {})).id;
    const data = {
      id: guild.id,
      name: guild.name,
      ownerId: guild.owner?.user?.tag,
      memberCount: guild.memberCount,
    };
    console.log("Guild Left: " + JSON.stringify(data));
    updateGuildLeft(guild).then(() => sendWebhook(guild, false));
  });
}

/**
 * @param {Guild} guild
 */
function sendWebhook(guild, isJoin) {
  const { client } = guild;

  const embed = new MessageEmbed()
    .setTitle(isJoin ? "Guild Joined" : "Guild Left")
    .setThumbnail(guild.iconURL())
    .setColor(isJoin ? EMBED_COLORS.SUCCESS_EMBED : EMBED_COLORS.ERROR_EMBED)
    .addField("Name", guild.name, false)
    .addField("ID", guild.id, false)
    .addField("Owner", `${client.users.cache.get(guild.ownerId)} [\`${guild.ownerId}\`]`, false)
    .addField("Members", "```yaml\n" + guild.memberCount + "```", false)
    .setFooter("Guild #" + client.guilds.cache.size);

  webhookClient.send({
    username: isJoin ? "Join" : "Leave",
    avatarURL: client.user.displayAvatarURL(),
    embeds: [embed],
  });
}

module.exports = {
  run,
};