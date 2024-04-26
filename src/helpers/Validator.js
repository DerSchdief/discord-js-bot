// const CommandCategory = require("@structures/CommandCategory");
const permissions = require("./permissions");
const config = require("@root/config");
const { log, warn, error } = require("./Logger");
const { ApplicationCommandType } = require("discord.js");

module.exports = class Validator {
  static validateConfiguration() {
    log("Validating config file and environment variables");

    // Bot Token
    // if (!process.env.BOT_TOKEN) {
    //   error("env: BOT_TOKEN cannot be empty");
    //   process.exit(1);
    // }

    if (!config.BOT_SETTINGS.BOT_TOKEN) {
      error("Config: BOT_TOKEN cannot be empty");
      process.exit(1);
    }

    // Validate Database Config
    // if (!process.env.MONGO_CONNECTION) {
    if (!config.BOT_SETTINGS.MONGO_CONNECTION) {
      error("Config: MONGO_CONNECTION cannot be empty");
      process.exit(1);
    }

    // Validate Dashboard Config
    if (config.DASHBOARD.enabled) {
      if (!config.DASHBOARD.BOT_SECRET) {
        error("env: BOT_SECRET cannot be empty");
        process.exit(1);
      }
      if (!config.DASHBOARD.SESSION_PASSWORD) {
        error("env: SESSION_PASSWORD cannot be empty");
        process.exit(1);
      }
      if (!config.DASHBOARD.baseURL || !config.DASHBOARD.failureURL || !config.DASHBOARD.port) {
        error("config.js: DASHBOARD details cannot be empty");
        process.exit(1);
      }
    }

    // Cache Size
    if (isNaN(config.CACHE_SIZE.GUILDS) || isNaN(config.CACHE_SIZE.USERS) || isNaN(config.CACHE_SIZE.MEMBERS)) {
      error("config.js: CACHE_SIZE must be a positive integer");
      process.exit(1);
    }

    // Music
    if (config.MUSIC.ENABLED) {
      if (!config.MUSIC.SPOTIFY_CLIENT_ID || !config.MUSIC.SPOTIFY_CLIENT_SECRET) {
        warn("env: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET are missing. Spotify music links won't work");
      }
      if (config.MUSIC.LAVALINK_NODES.length == 0) {
        warn("config.js: There must be at least one node for Lavalink");
      }
      if (!["YT", "YTM", "SC"].includes(config.MUSIC.DEFAULT_SOURCE)) {
        warn("config.js: MUSIC.DEFAULT_SOURCE must be either YT, YTM or SC");
      }
    }

    // Warnings
    if (config.OWNER_IDS.length === 0) warn("config.js: OWNER_IDS are empty");
    if (!config.SUPPORT_SERVER) warn("config.js: SUPPORT_SERVER is not provided");
    if (!config.BOT_SETTINGS.WEATHERSTACK_KEY) warn("env: WEATHERSTACK_KEY is missing. Weather command won't work");
    if (!config.BOT_SETTINGS.STRANGE_API_KEY) warn("env: STRANGE_API_KEY is missing. Image commands won't work");
  }

  /**
   * @param {import('@structures/Command')} cmd
   */
  static validateCommand(cmd) {
    if (typeof cmd !== "object") {
      throw new TypeError("Command data must be an Object.");
    }
    if (typeof cmd.name !== "string" || cmd.name !== cmd.name.toLowerCase()) {
      throw new Error("Command name must be a lowercase string.");
    }
    if (typeof cmd.description !== "string") {
      throw new TypeError("Command description must be a string.");
    }
    if (cmd.cooldown && typeof cmd.cooldown !== "number") {
      throw new TypeError("Command cooldown must be a number");
    }
    // if (cmd.category) {
    //   if (!Object.prototype.hasOwnProperty.call(CommandCategory, cmd.category)) {
    //     throw new Error(`Not a valid category ${cmd.category}`);
    //   }
    // }
    if (cmd.category && typeof cmd.category !== "string") {
        throw new Error(`Command Category must be a string`);
    }
    if (cmd.userPermissions) {
      if (!Array.isArray(cmd.userPermissions)) {
        throw new TypeError("Command userPermissions must be an Array of permission key strings.");
      }
      for (const perm of cmd.userPermissions) {
        if (!permissions[perm]) throw new RangeError(`Invalid command userPermission: ${perm}`);
      }
    }
    if (cmd.botPermissions) {
      if (!Array.isArray(cmd.botPermissions)) {
        throw new TypeError("Command botPermissions must be an Array of permission key strings.");
      }
      for (const perm of cmd.botPermissions) {
        if (!permissions[perm]) throw new RangeError(`Invalid command botPermission: ${perm}`);
      }
    }
    if (cmd.validations) {
      if (!Array.isArray(cmd.validations)) {
        throw new TypeError("Command validations must be an Array of validation Objects.");
      }
      for (const validation of cmd.validations) {
        if (typeof validation !== "object") {
          throw new TypeError("Command validations must be an object.");
        }
        if (typeof validation.callback !== "function") {
          throw new TypeError("Command validation callback must be a function.");
        }
        if (typeof validation.message !== "string") {
          throw new TypeError("Command validation message must be a string.");
        }
      }
    }

    // Validate Command Details
    if (cmd.command) {
      if (typeof cmd.command !== "object") {
        throw new TypeError("Command.command must be an object");
      }
      if (Object.prototype.hasOwnProperty.call(cmd.command, "enabled") && typeof cmd.command.enabled !== "boolean") {
        throw new TypeError("Command.command enabled must be a boolean value");
      }
      if (
        cmd.command.aliases &&
        (!Array.isArray(cmd.command.aliases) ||
          cmd.command.aliases.some((ali) => typeof ali !== "string" || ali !== ali.toLowerCase()))
      ) {
        throw new TypeError("Command.command aliases must be an Array of lowercase strings.");
      }
      if (cmd.command.usage && typeof cmd.command.usage !== "string") {
        throw new TypeError("Command.command usage must be a string");
      }
      if (cmd.command.minArgsCount && typeof cmd.command.minArgsCount !== "number") {
        throw new TypeError("Command.command minArgsCount must be a number");
      }
      if (cmd.command.subcommands && !Array.isArray(cmd.command.subcommands)) {
        throw new TypeError("Command.command subcommands must be an array");
      }
      if (cmd.command.subcommands) {
        for (const sub of cmd.command.subcommands) {
          if (typeof sub !== "object") {
            throw new TypeError("Command.command subcommands must be an array of objects");
          }
          if (typeof sub.trigger !== "string") {
            throw new TypeError("Command.command subcommand trigger must be a string");
          }
          if (typeof sub.description !== "string") {
            throw new TypeError("Command.command subcommand description must be a string");
          }
        }
      }
      if (cmd.command.enabled && typeof cmd.messageRun !== "function") {
        throw new TypeError("Missing 'messageRun' function");
      }
    }

    // Validate Slash Command Details
    if (cmd.slashCommand) {
      if (typeof cmd.slashCommand !== "object") {
        throw new TypeError("Command.slashCommand must be an object");
      }
      if (
        Object.prototype.hasOwnProperty.call(cmd.slashCommand, "enabled") &&
        typeof cmd.slashCommand.enabled !== "boolean"
      ) {
        throw new TypeError("Command.slashCommand enabled must be a boolean value");
      }
      if (
        Object.prototype.hasOwnProperty.call(cmd.slashCommand, "ephemeral") &&
        typeof cmd.slashCommand.ephemeral !== "boolean"
      ) {
        throw new TypeError("Command.slashCommand ephemeral must be a boolean value");
      }
      if (cmd.slashCommand.options && !Array.isArray(cmd.slashCommand.options)) {
        throw new TypeError("Command.slashCommand options must be a array");
      }
      if (cmd.slashCommand.enabled && typeof cmd.interactionRun !== "function") {
        throw new TypeError("Missing 'interactionRun' function");
      }
    }
  }

  /**
   * @param {import('@structures/BaseSelectMenu')} selectMenu
   */
  static validateSelectMenu(selectMenu) {
    if (typeof selectMenu !== "object") {
      throw new TypeError("SelectMenu must be an object");
    }
    if (typeof selectMenu.id !== "string" || selectMenu.id !== selectMenu.id.toLowerCase()) {
      throw new Error("SelectMenu id must be a lowercase string.");
    }
    if (typeof selectMenu.description !== "string") {
      throw new TypeError("SelectMenu description must be a string.");
    }
    if (selectMenu.type !== ApplicationCommandType.User && selectMenu.type !== ApplicationCommandType.Message) {
      throw new TypeError("SelectMenu type must be a either User/Message.");
    }
    if (Object.prototype.hasOwnProperty.call(selectMenu, "enabled") && typeof selectMenu.enabled !== "boolean") {
      throw new TypeError("SelectMenu enabled must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(selectMenu, "ephemeral") && typeof selectMenu.ephemeral !== "boolean") {
      throw new TypeError("SelectMenu enabled must be a boolean value");
    }
    if (
      Object.prototype.hasOwnProperty.call(selectMenu, "defaultPermission") &&
      typeof selectMenu.defaultPermission !== "boolean"
    ) {
      throw new TypeError("SelectMenu defaultPermission must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(selectMenu, "cooldown") && typeof selectMenu.cooldown !== "number") {
      throw new TypeError("SelectMenu cooldown must be a number");
    }
    if (selectMenu.userPermissions) {
      if (!Array.isArray(selectMenu.userPermissions)) {
        throw new TypeError("SelectMenu userPermissions must be an Array of permission key strings.");
      }
      for (const perm of selectMenu.userPermissions) {
        if (!permissions[perm]) throw new RangeError(`Invalid command userPermission: ${perm}`);
      }
    }
  }

  /**
   * @param {import('@structures/BaseModal')} modal
   */
  static validateModal(modal) {
    if (typeof modal !== "object") {
      throw new TypeError("Modal must be an object");
    }
    if (typeof modal.id !== "string" ) { //|| modal.id !== modal.id.toLowerCase()
      throw new Error("Modal id must be a lowercase string.");
    }
    if (typeof modal.description !== "string") {
      throw new TypeError("Modal description must be a string.");
    }
    if (modal.type !== ApplicationCommandType.User && modal.type !== ApplicationCommandType.Message) {
      throw new TypeError("Modal type must be a either User/Message.");
    }
    if (Object.prototype.hasOwnProperty.call(modal, "enabled") && typeof modal.enabled !== "boolean") {
      throw new TypeError("Modal enabled must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(modal, "ephemeral") && typeof modal.ephemeral !== "boolean") {
      throw new TypeError("Modal enabled must be a boolean value");
    }
    if (
      Object.prototype.hasOwnProperty.call(modal, "defaultPermission") &&
      typeof modal.defaultPermission !== "boolean"
    ) {
      throw new TypeError("Modal defaultPermission must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(modal, "cooldown") && typeof modal.cooldown !== "number") {
      throw new TypeError("Modal cooldown must be a number");
    }
    if (modal.userPermissions) {
      if (!Array.isArray(modal.userPermissions)) {
        throw new TypeError("Modal userPermissions must be an Array of permission key strings.");
      }
      for (const perm of modal.userPermissions) {
        if (!permissions[perm]) throw new RangeError(`Invalid command userPermission: ${perm}`);
      }
    }
  }

  /**
   * @param {import('@structures/BaseButton')} button
   */
  static validateButton(button) {
    if (typeof button !== "object") {
      throw new TypeError("Button must be an object");
    }
    if (typeof button.id !== "string" || button.id !== button.id.toLowerCase()) {
      throw new Error("Button id must be a lowercase string.");
    }
    if (typeof button.description !== "string") {
      throw new TypeError("Button description must be a string.");
    }
    if (button.type !== ApplicationCommandType.User && button.type !== ApplicationCommandType.Message) {
      throw new TypeError("Button type must be a either User/Message.");
    }
    if (Object.prototype.hasOwnProperty.call(button, "enabled") && typeof button.enabled !== "boolean") {
      throw new TypeError("Button enabled must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(button, "ephemeral") && typeof button.ephemeral !== "boolean") {
      throw new TypeError("Button enabled must be a boolean value");
    }
    if (
      Object.prototype.hasOwnProperty.call(button, "defaultPermission") &&
      typeof button.defaultPermission !== "boolean"
    ) {
      throw new TypeError("Button defaultPermission must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(button, "cooldown") && typeof button.cooldown !== "number") {
      throw new TypeError("Button cooldown must be a number");
    }
    if (button.userPermissions) {
      if (!Array.isArray(button.userPermissions)) {
        throw new TypeError("Button userPermissions must be an Array of permission key strings.");
      }
      for (const perm of button.userPermissions) {
        if (!permissions[perm]) throw new RangeError(`Invalid command userPermission: ${perm}`);
      }
    }
  }

  /**
   * @param {import('@structures/BaseContext')} context
   */
  static validateContext(context) {
    if (typeof context !== "object") {
      throw new TypeError("Context must be an object");
    }
    if (typeof context.name !== "string" || context.name !== context.name.toLowerCase()) {
      throw new Error("Context name must be a lowercase string.");
    }
    if (typeof context.description !== "string") {
      throw new TypeError("Context description must be a string.");
    }
    if (context.type !== ApplicationCommandType.User && context.type !== ApplicationCommandType.Message) {
      throw new TypeError("Context type must be a either User/Message.");
    }
    if (Object.prototype.hasOwnProperty.call(context, "enabled") && typeof context.enabled !== "boolean") {
      throw new TypeError("Context enabled must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(context, "ephemeral") && typeof context.ephemeral !== "boolean") {
      throw new TypeError("Context enabled must be a boolean value");
    }
    if (
      Object.prototype.hasOwnProperty.call(context, "defaultPermission") &&
      typeof context.defaultPermission !== "boolean"
    ) {
      throw new TypeError("Context defaultPermission must be a boolean value");
    }
    if (Object.prototype.hasOwnProperty.call(context, "cooldown") && typeof context.cooldown !== "number") {
      throw new TypeError("Context cooldown must be a number");
    }
    if (context.userPermissions) {
      if (!Array.isArray(context.userPermissions)) {
        throw new TypeError("Context userPermissions must be an Array of permission key strings.");
      }
      for (const perm of context.userPermissions) {
        if (!permissions[perm]) throw new RangeError(`Invalid command userPermission: ${perm}`);
      }
    }
  }
};
