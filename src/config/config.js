module.exports = {
  OWNER_IDS: [ // Bot owner ID's
    {
      name: "DerSchdief",
      id: "271653961067528192"
    },
    {
      name: "BlackPhoenix",
      id: "845575385370066954"
    },
    // {
    //   name: "TestDC",
    //   id: "937055022850650112"
    // },
  ],
  SUPPORT_SERVER: "", // Your bot support server

  BOT_SETTINGS: {
    BOT_TOKEN: "",
    // MONGO_CONNECTION: "mongodb://mongodb:mongodb@mongodb:27017",
    MONGO_CONNECTION: "",
    WEATHERSTACK_KEY: "",
    STRANGE_API_KEY: "",
    ERROR_LOGS: "",
    JOIN_LEAVE_LOGS: "",
    BOT_ID: "1031492577796558848",
    BOT_Name: "CoKBot",
    MAINTENANCEMODE: false,
  },

  PREFIX_COMMANDS: {
    ENABLED: false, // Enable/Disable prefix commands
    DEFAULT_PREFIX: "!", // Default prefix for the bot
  },
  INTERACTIONS: {
    SLASH: true, // Should the interactions be enabled
    CONTEXT: false, // Should contexts be enabled
    GLOBAL: true, // Should the interactions be registered globally
    TEST_GUILD_ID: "1061059002877886524", // Guild ID where the interactions should be registered. [** Test you commands here first **]
  },
  EMBED_COLORS: {
    BOT_EMBED: "#068ADD",
    TRANSPARENT: "#36393F",
    SUCCESS: "#00A56A",
    ERROR: "#D61A3C",
    WARNING: "#F7E919",
  },
  CACHE_SIZE: {
    GUILDS: 100,
    USERS: 10000,
    MEMBERS: 10000,
  },
  MESSAGES: {
    API_ERROR: "Unexpected Backend Error! Try again later or contact support server",
  },

  // PLUGINS

  ADMIN: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/dakirby309/simply-styled/256/Settings-icon.png",
    emoji: "⚙️",
  },

  AUTOMOD: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/dakirby309/simply-styled/256/Settings-icon.png",
    emoji: "🤖",
    LOG_EMBED: "#36393F",
    DM_EMBED: "#36393F",
  },

  ANIME: {
    ENABLED: false,
    image: "https://wallpaperaccess.com/full/5680679.jpg",
    emoji: "🎨",
  },

  DASHBOARD: {
    ENABLED: false, // enable or disable dashboard
    baseURL: "http://localhost:8080", // base url
    failureURL: "http://localhost:8080", // failure redirect url
    port: "8080", // port to run the bot on
  },

  ECONOMY: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/custom-icon-design/pretty-office-11/128/coins-icon.png",
    emoji: "🪙",
    CURRENCY: "₪",
    DAILY_COINS: 100, // coins to be received by daily command
    MIN_BEG_AMOUNT: 100, // minimum coins to be received when beg command is used
    MAX_BEG_AMOUNT: 2500, // maximum coins to be received when beg command is used
  },

  FUN: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/flameia/aqua-smiles/128/make-fun-icon.png",
    emoji: "😂",
  },

  GIVEAWAYS: {
    ENABLED: false,
    image: "https://cdn-icons-png.flaticon.com/512/4470/4470928.png",
    emoji: "🎉",
    REACTION: "🎁",
    START_EMBED: "#FF468A",
    END_EMBED: "#FF468A",
  },

  IMAGE: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/dapino/summer-holiday/128/photo-icon.png",
    emoji: "🖼️",
    BASE_API: "https://strangeapi.hostz.me/api",
  },

  INVITE: {
    ENABLED: false,
    image: "https://cdn4.iconfinder.com/data/icons/general-business/150/Invite-512.png",
    emoji: "📨",
  },

  INFORMATION: {
    ENABLED: false, //true
    image: "https://icons.iconarchive.com/icons/graphicloads/100-flat/128/information-icon.png",
    emoji: "🪧",
  },

  MODERATION: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/lawyerwordpress/law/128/Gavel-Law-icon.png",
    emoji: "🔨",
    EMBED_COLORS: {
      TIMEOUT: "#102027",
      UNTIMEOUT: "#4B636E",
      KICK: "#FF7961",
      SOFTBAN: "#AF4448",
      BAN: "#D32F2F",
      UNBAN: "#00C853",
      VMUTE: "#102027",
      VUNMUTE: "#4B636E",
      DEAFEN: "#102027",
      UNDEAFEN: "#4B636E",
      DISCONNECT: "RANDOM",
      MOVE: "RANDOM",
    },
  },

  MUSIC: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/wwalczyszyn/iwindows/256/Music-Library-icon.png",
    emoji: "🎵",
    IDLE_TIME: 60, // Time in seconds before the bot disconnects from an idle voice channel
    MAX_SEARCH_RESULTS: 5,
    DEFAULT_SOURCE: "YTM", // YT = Youtube, YTM = Youtube Music, SC = SoundCloud
    SPOTIFY_CLIENT_ID: "51dcb7b95fc54770b051f0840e1fab92",
    SPOTIFY_CLIENT_SECRET: "cb874eff949c420c85fe8d295da1d86a",
    // Add any number of lavalink nodes here
    // Refer to https://github.com/freyacodes/Lavalink to host your own lavalink server
    LAVALINK_NODES: [
      { // Important to have at least 1 node
        authorization: "youshallnotpass",
        host: "lavalink",
        port: 2333,
        id: "HomeLab LavaLink"
      },
      { // Important to have at least 1 node
        authorization: "oryzen.xyz",
        host: "lavalink.oryzen.xyz",
        port: 80,
        id: "oryzen"
      },
        // { // Important to have at least 1 node
        //   authorization: "oryzen.xyz",
        //   host: "lavalink.oryzen.xyz",
        //   port: 80,
        //   id: "Lavalink Extern"
        // }
    ],
  },

  PRESENCE: {
    ENABLED: true, // Whether or not the bot should update its status
    STATUS: "dnd", // The bot's status [online, idle, dnd, invisible]
    TYPE: "WATCHING", // Status type for the bot [PLAYING | LISTENING | WATCHING | COMPETING]
    MESSAGE: "dich dumm an!", // Your bot status message
    // MESSAGE: "{members} members in {servers} servers", // Your bot status message
  },

  OWNER: {
    ENABLED: true,
    image: "https://www.pinclipart.com/picdir/middle/531-5318253_web-designing-icon-png-clipart.png",
    emoji: "🤴",
  },

  SOCIAL: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/dryicons/aesthetica-2/128/community-users-icon.png",
    emoji: "🫂",
  },

  STATS: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/graphicloads/flat-finance/256/dollar-stats-icon.png",
    emoji: "📈",
    XP_COOLDOWN: 5, // Cooldown in seconds between messages
    DEFAULT_LVL_UP_MSG: "{member:tag}, You just advanced to **Level {level}**",
  },

  SUGGESTIONS: {
    ENABLED: false, // Should the suggestion system be enabled
    image: "https://cdn-icons-png.flaticon.com/512/1484/1484815.png",
    emoji: "📝",
    EMOJI: {
      UP_VOTE: "⬆️",
      DOWN_VOTE: "⬇️",
    },
    DEFAULT_EMBED: "#4F545C",
    APPROVED_EMBED: "#43B581",
    DENIED_EMBED: "#F04747",
  },

  TICKET: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/custom-icon-design/flatastic-2/512/ticket-icon.png",
    emoji: "🎫",
    CREATE_EMBED: "#068ADD",
    CLOSE_EMBED: "#068ADD",
  },

  UTILITY: {
    ENABLED: false,
    image: "https://icons.iconarchive.com/icons/blackvariant/button-ui-system-folders-alt/128/Utilities-icon.png",
    emoji: "🛠",
  },

  VALORANT: {
    ENABLED: true,
    HDevToken: "HDEV-5c9c1d72-4e49-4eda-a19d-317485b77140",
    HDevTokenAlert: true,
    //TODO useUnofficialValorantApi: true,
    fetchSkinPrices: true,
    fetchSkinRarities: true,
    localiseText: true,
    localiseSkinNames: true,
    linkItemImage: true,
    videoViewerWithSite: true,
    imageViewerWithSite: false,
    useEmojisFromServer: "1061059002877886524",
    refreshSkins: "10 0 0 * * *",
    // refreshSkins: "*/2 * * * *",
    checkGameVersion: "*/15 * * * *",
    updateUserAgent: "*/15 * * * *",
    delayBetweenAlerts: 5 * 1000,
    alertsPerPage: 10,
    careerCacheExpiration: 10 * 60 * 1000,
    emojiCacheExpiration: 10 * 1000,
    loadoutCacheExpiration: 10 * 60 * 1000,
    useShopCache: true,
    useLoginQueue: false,
    loginQueueInterval: 3000,
    loginQueuePollRate: 2000,
    loginRetryTimeout: 10 * 60 * 1000,
    authFailureStrikes: 2,
    maxAccountsPerUser: 5,
    userDataCacheExpiration: 168,
    rateLimitBackoff: 60,
    rateLimitCap: 10 * 60,
    useMultiqueue: false,
    storePasswords: false,
    trackStoreStats: true,
    statsExpirationDays: 14,
    statsPerPage: 8,
    shardReadyTimeout: 60 * 1000,
    autoDeployCommands: true,
    ownerId: "",
    ownerName: "DerSchdief",
    status: "Up and running!",
    notice: "",
    onlyShowNoticeOnce: true,
    maintenanceMode: false,
    githubToken: "",
    logToChannel: "",
    logFrequency: "*/10 * * * * *",
    logUrls: false,
  },
  
};
