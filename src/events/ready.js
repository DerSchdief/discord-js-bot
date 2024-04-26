const { counterHandler, inviteHandler, presenceHandler } = require("@src/handlers");
const { cacheReactionRoles } = require("@schemas/ReactionRoles");
const { getSettings } = require("@schemas/Guild");
const { fetchData, fetchRiotClientVersion, destroyTasks, scheduleTasks, transferUserDataFromOldUsersJson } = require("@helpers/Valorant");

/**
 * @param {import('@src/structures').BotClient} client
 */
module.exports = async (client) => {
  client.logger.success(`Logged in as ${client.user.tag}! (${client.user.id})`);

  // Initialize Music Manager
  if (client.config.MUSIC.ENABLED) {
    await client.lavalink.init({ 
      id: client.config.BOT_SETTINGS.BOT_ID, 
      username: client.config.BOT_SETTINGS.BOT_Name
    });
    client.logger.success("Music Manager initialized");
  }

  // Initialize Giveaways Manager
  if (client.config.GIVEAWAYS.ENABLED) {
    client.logger.log("Initializing giveaways manager...");
    client.giveawaysManager._init().then((_) => client.logger.success("Giveaway Manager initialized"));
  }

  // Update Bot Presence
  if (client.config.PRESENCE.ENABLED) {
    presenceHandler(client);
  }


  // client.application.commands.set([]);
  // const test = client.guilds.cache.get(client.config.INTERACTIONS.TEST_GUILD_ID);
  // await test.commands.set([]);
  // Register Interactions
  if (client.config.INTERACTIONS.SLASH || client.config.INTERACTIONS.CONTEXT) {
    if (client.config.INTERACTIONS.GLOBAL) await client.registerInteractions();
    else await client.registerInteractions(client.config.INTERACTIONS.TEST_GUILD_ID);
  }

  // Load reaction roles to cache
  await cacheReactionRoles(client);

  for (const guild of client.guilds.cache.values()) {
    const settings = await getSettings(guild);

    // initialize counter
    if (settings.counters.length > 0) {
      await counterHandler.init(guild, settings);
    }

    // cache invites
    if (settings.invite.tracking) {
      inviteHandler.cacheGuildInvites(guild);
    }
  }

  fetchData().then(() => client.logger.success("Skins loaded!"));
  fetchRiotClientVersion().then(() => client.logger.success("Fetched latest Riot user-agent!"));
  destroyTasks();
  scheduleTasks();
  transferUserDataFromOldUsersJson()

  setInterval(() => counterHandler.updateCounterChannels(client), 10 * 60 * 1000);
};
