const { ApplicationCommandType, } = require("discord.js");
const { handleSettingDropdown } = require("@helpers/Valorant");

/**
* @type {import("@structures/BaseSelectMenu")}
*/
module.exports = {
  id: "set-setting",
  description: "Set Settings Menu",
  type: ApplicationCommandType.User,
  enabled: true,
  ephemeral: false,
  options: true,
  userPermissions: [],
  cooldown: 0,

  async run(interaction) {
    await handleSettingDropdown(interaction);
  },
};
