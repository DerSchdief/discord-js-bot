/**
 * @typedef {Object} ModalData
 * @property {string} id - The id of the command (must be lowercase)
 * @property {string} description - A short description of the command
 * @property {import('discord.js').ApplicationCommandType} type - The type of application command
 * @property {string} [category] - The category this command belongs to
 * @property {boolean} [enabled] - Whether the slash command is enabled or not
 * @property {boolean} [ephemeral] - Whether the reply should be ephemeral
 * @property {boolean} [defaultPermission] - Whether default permission must be enabled
 * @property {import('discord.js').PermissionResolvable[]} [userPermissions] - Permissions required by the user to use the command.
 * @property {number} [cooldown] - Command cooldown in seconds
 * @property {function(import('discord.js').ModalSubmitInteraction)} run - The callback to be executed when the context is invoked
 */

/**
 * @type {ModalData} data - The context information
 */
module.exports = {
  id: "",
  description: "",
  type: "",
  category: "",
  enabled: false,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,
};
