const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ApplicationCommandOptionType,
  } = require("discord.js");

const {
        searchBundle, basicEmbed, secondaryEmbed, s, l, fetchChannel, defer, VPEmoji,
        discToValLang, DEFAULT_VALORANT_LANG, valNamesToDiscordNames, renderBundle
    } = require("@helpers/Valorant");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "bundle",
    description: "Inspect a specific bundle.",
    category: "VALORANT",
    // botPermissions: ["EmbedLinks"],
    // command: {
    //   enabled: true,
    //   usage: "[command]",
    // },
    slashCommand: {
      enabled: true,
      options: [
        {
          name: "bundle",
          description: "The name of the bundle you want to inspect!",
          required: true,
          autocomplete: true,
          type: ApplicationCommandOptionType.String,
        },
      ],
    },

    async messageRun(message, args, data) {
        //nix
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const searchResults = await searchBundle(focusedValue, interaction.locale, 5);

        // interaction.client.logger.debug(searchResults);

        await interaction.respond(searchResults.map(result => ({
            name: result.obj.names[discToValLang[interaction.locale] || DEFAULT_VALORANT_LANG],
            value: result.obj.names[discToValLang[interaction.locale] || DEFAULT_VALORANT_LANG],
            // nameLocalizations: valNamesToDiscordNames(result.obj.names) // does this even work?
        })));
    },

    async interactionRun(interaction) {
        const searchQuery = interaction.options.get("bundle").value.replace(/collection/i, "").replace(/bundle/i, "");
        const searchResults = await searchBundle(searchQuery, interaction.locale, 25);

        const channel = interaction.channel || await fetchChannel(interaction.channelId);
        const emoji = await VPEmoji(interaction, channel);

        // if the name matches exactly, and there is only one with that name
        const nameMatchesExactly = (interaction) => searchResults.filter(r => l(r.obj.names, interaction).toLowerCase() === searchQuery.toLowerCase()).length === 1;

        if (searchResults.length === 0) {
            return await interaction.followUp({
                embeds: [basicEmbed(s(interaction).error.BUNDLE_NOT_FOUND)],
                ephemeral: true
            });
        } else if (searchResults.length === 1 || nameMatchesExactly(interaction) || nameMatchesExactly()) { // check both localized and english
            const bundle = searchResults[0].obj;
            const message = await renderBundle(bundle, interaction, emoji)

            return await interaction.followUp(message);
        } else {
            const row = new ActionRowBuilder();

            const options = searchResults.map(result => {
                return {
                    label: l(result.obj.names, interaction),
                    value: `bundle-${result.obj.uuid}`
                }
            });

            // some bundles have the same name (e.g. Magepunk)
            const nameCount = {};
            for (const option of options) {
                if (option.label in nameCount) nameCount[option.label]++;
                else nameCount[option.label] = 1;
            }

            for (let i = options.length - 1; i >= 0; i--) {
                const occurrence = nameCount[options[i].label]--;
                if (occurrence > 1) options[i].label += " " + occurrence;
            }

            row.addComponents(new StringSelectMenuBuilder().setCustomId("bundle-select").setPlaceholder(s(interaction).info.BUNDLE_CHOICE_PLACEHOLDER).addOptions(options));

            await interaction.followUp({
                embeds: [secondaryEmbed(s(interaction).info.BUNDLE_CHOICE)],
                components: [row]
            });
        }

        
    }
  }