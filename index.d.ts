/// <reference types="node" />

import { EventEmitter } from 'events';
import { Request } from 'request';
import * as SteamID from 'steamid';

declare namespace SteamCommunity {
    type GroupEventType =
        | 'ChatEvent'
        | 'OtherEvent'
        | 'PartyEvent'
        | 'MeetingEvent'
        | 'SpecialCauseEvent'
        | 'MusicAndArtsEvent'
        | 'SportsEvent'
        | 'TripEvent';
    type AvatarSizeType = 'full' | 'medium' | 'small';
    type ProtocolType = 'http://' | 'https://' | '//';
    type ImageFormat = 'jpg' | 'jpeg' | 'gif' | 'png';

    const SteamID: SteamID;

    class CConfirmation {
        /** The ID of this confirmation. This is not the same as a trade offer ID. */
        id: string;

        /**
         * What type of thing this confirmation wants to confirm. The enum is available as a property of
         * {@link https://github.com/DoctorMcKay/node-steamcommunity/blob/master/index.js#L13-L18|SteamCommunity}.
         */
        type: ConfirmationType;

        /**
         * The ID of the thing that created this confirmation (trade offer ID for a trade, market listing ID for a
         * market listing).
         */
        creator: string;

        /**
         * The key for this confirmation. This is required when confirming or canceling the confirmation. This is not
         * the same as the TOTP confirmation key.
         */
        key: string;

        /** The title of this confirmation. */
        title: string;

        /**
         * A textual description of what you will receive from this confirmation, if this is a trade. If this is a
         * market listing, then this is a string containing the list price and then the amount you will receive
         * parenthetically. For example: `$115.00 ($100.00)`
         */
        receiving: string;

        /** A textual description of when this confirmation was created. */
        time: string;

        /**
         * The URL to your trading partner's avatar, if this is a trade. The URL to the image of the item, if this is a
         * market listing. Otherwise, an empty string.
         */
        icon: string;
        offerID: string | null;

        /**
         * Gets the ID of the trade offer that this confirmation is confirming, if it's for a trade.
         *
         * @param time - The Unix timestamp with which the following key was generated.
         * @param key - The confirmation key that was generated using the preceeding time and the tag "details" (this
         *   key can be reused). You can use {@link https://www.npmjs.com/package/steam-totp|steam-totp} to generate this.
         * @param callback - Called when the request completes.
         *
         *   - `err` - An Error object on failure, or null on success.
         *   - `offerID` - The ID of the trade offer this is confirming, or null if not a confirmation for a trade offer.
         */
        getOfferID(time: number, key: string, callback: (err: Error | null, offerId: string | null) => void): void;

        /**
         * @param time - The Unix timestamp with which the following key was generated
         * @param key - The confirmation key that was generated using the preceeding time and the tag "details" (this
         *   key can be reused). You can use {@link https://www.npmjs.com/package/steam-totp|steam-totp} to generate this.
         * @param accept - `true` if you are accepting, `false` if you are canceling
         * @param callback - Called when the request completes
         *
         *   - `err` - An Error object on failure, or null on success
         */
        respond(time: number, key: string, accept: boolean, callback: (err: Error | null) => void): void;
    }

    class CEconItem {
        constructor(item: Item, description: EconItemDescription, contextID: string);

        currencyid: string;

        /** The item's unique ID within its app+context. */
        id: string;

        /** The item's unique ID within its app+context. */
        assetid: string;

        /** The second half of the item cache identifier. */
        instanceid: string;

        /** How much of this item is in this stack. */
        amount: number;

        /** The ID of the context within the app in which the item resides. */
        contextid: string;
        is_currency: boolean;

        /** `true` if the item can be traded, `false` if not. */
        tradable: boolean;

        /** `true` if the item can be listed on the Steam Community Market, `false` if not. */
        marketable: boolean;

        /** `true` if, on the Steam Community Market, this item will use buy orders. `false` if not. */
        commodity: boolean;

        /** How many days for which the item will be untradable after being sold on the market. */
        market_tradable_restriction: number;

        /** How many days for which the item will be unmarketable after being sold on the market. */
        market_marketable_restriction: number;

        /**
         * An array of strings containing "fraud warnings" about the item. In inventories and trades, items with fraud
         * warnings have a red (!) symbol, and fraud warnings are displayed in red under the item's name.
         */
        fraudwarnings: string[];

        /** An array of objects containing information about the item. Displayed under the item's `type`. */
        descriptions: EconItemDescription[];
        owner: any;

        /** An array of objects containing the item's inventory tags. */
        tags: Tag[];
        market_fee_app: number;
        cache_expiration: string;
        actions: EconItemAction[];

        /**
         * Returns a URL where this item's image can be downloaded. You can optionally append a size as such:
         *
         * ```js
         * var url = item.getImageURL() + '128x128';
         * ```
         */
        getImageURL(): string;

        /** Returns a URL where this item's image can be downloaded. */
        getLargeImageURL(): string;

        /**
         * Returns a specific tag from the item, or `null` if it doesn't exist.
         *
         * @param category - A string containing the tag's category (the `category` property of the tag object).
         */
        getTag(category: string): Tag | null;
    }

    class CMarketItem {
        /** `true` if this is a commodity item (buy/sell orders) or `false` otherwise. */
        commodity: boolean;

        /** If this is a commodity item, this will be the item's commodity ID. Not defined otherwise. */
        commodityID: string;

        medianSalePrices: {
            /** A `Date` object representing the hour that this object contains data for. */
            hour: Date;

            /** The median price at which this item was sold during this hour (as a float). */
            price: number;

            /** The amount of this item which was sold during this hour. */
            quantity: number;
        };

        /** How many copies of this item are currently available on the market. */
        quantity: number;

        /** The lowest price at which this item is sold, in cents. */
        lowestPrice: number;

        /** If this is a commodity, how many buy orders there are for this item. Not defined otherwise. */
        buyQuantity: number;

        /** If this is a commodity, the value of the highest buy order for this item, in cents. Not defined otherwise. */
        highestBuyOrder: number;

        updatePrice(currency: string, callback: (err: Error | null) => void): void;
        updatePriceForCommodity(currency: string, callback: (err: Error | null) => void): void;
        updatePriceForNonCommodity(currency: string, callback: (err: Error | null) => void): void;
    }

    class CMarketSearchResult {
        /** The AppID of the game to which this item belongs. */
        appid: string;

        /** The `market_hash_name` of the item, otherwise known as the English version of the item's name on the market. */
        market_hash_name: string;

        /**
         * A URL to a 512x512 image of this item. You can get custom sizes by simply appending your desired size to this
         * URL. For example, to get a 64x64 image, just use `item.image + '64x64'`.
         */
        image: string;

        /** The lowest price of this item on the market, in the lowest denomination of your currency (e.g. USD cents). */
        price: number;

        /** How many of this item there are currently listed on the market. */
        quantity: number;
    }

    class CSteamGroup {
        /** A SteamID object containing the group's SteamID. */
        steamID: SteamID;

        /** The group's name. */
        name: string;

        /** The group's URL. */
        url: string;

        /** The group's headline. */
        headline: string;

        /** The group's summary content. */
        summary: string;

        /** The hash of the group's avatar. */
        avatarHash: string;

        /** How many members the group had when `getSteamGroup` was called. */
        members: number;

        /** How many group members were in group chat when `getSteamGroup` was called. */
        membersInChat: number;

        /** How many group members were in-game when `getSteamGroup` was called. */
        membersInGame: number;

        /** How many group members were online on Steam when `getSteamGroup` was called. */
        membersOnline: number;

        /** Returns a URL where you can download this group's avatar. */
        getAvatarURL(): string;

        /**
         * Returns a URL where you can download this group's avatar.
         *
         * @param size - What size to get the avatar at. Possible values are full, medium, or empty (small).
         * @param protocol - The protocol to use. Possible values for protocol are `http://`, `https://`.
         */
        getAvatarURL(size: AvatarSizeType, protocol: ProtocolType): string;

        /**
         * Retrieves a list of all users in this group. For large groups this could take around 30 seconds, possibly longer.
         *
         * @param callback - Called when the member list is available.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         *   - `members` - An array of `SteamID` objects.
         */
        getMembers(callback: (err: Error | null, members: SteamID[]) => void): void;

        /**
         * Retrieves a list of all users in this group. For large groups this could take around 30 seconds, possibly longer.
         *
         * @param addresses - An array of IP addresses (in `x.x.x.x` format) that will be rotated between when paging
         *   through the results.
         * @param callback - Called when the member list is available.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         *   - `members` - An array of `SteamID` objects.
         */
        getMembers(addresses: string[], callback: (err: Error | null, members: SteamID[]) => void): void;

        /**
         * Joins a group. If the group is restricted, requests to join.
         *
         * @param callback - Called when the request completes
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        join(callback?: (err: Error | null) => void): void;

        /**
         * Leaves a group.
         *
         * @param callback - Called when the request completes
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        leave(callback?: (err: Error | null) => void): void;

        /**
         * Gets all announcements posted to the group.
         *
         * @param time - A `Date` object. If specified, only announcements posted after this time are returned.
         * @param callback - Called when requested data is available.
         *
         *   - `err` - `null` on success, or an `Error` object on failure.
         *   - `announcements` - An array of announcement objects. ** `headline` - The announcement's title. ** `content` -
         *       The content of the announcement. ** `date` - A `Date` object for when this was posted. ** `author` -
         *       The Steam profile name of the author. ** `aid` - The ID of the announcement.
         */
        getAllAnnouncements(time: Date, callback: (err: Error, announcements: Announcement[]) => void): void;

        /**
         * Gets all announcements posted to the group.
         *
         * @param callback - Called when requested data is available.
         *
         *   - `err` - `null` on success, or an `Error` object on failure.
         *   - `announcements` - An array of announcement objects. ** `headline` - The announcement's title. ** `content` -
         *       The content of the announcement. ** `date` - A `Date` object for when this was posted. ** `author` -
         *       The Steam profile name of the author. ** `aid` - The ID of the announcement.
         */
        getAllAnnouncements(callback: (err: Error, announcements: Announcement[]) => void): void;

        /**
         * Posts an announcement to a group, provided you have permission to do so.
         *
         * @param headline - The title of the announcement
         * @param content - What the announcement says
         * @param callback - Called when the request completes
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        postAnnouncement(headline: string, content: string, callback: (err: Error | null) => void): void;

        /**
         * Posts an announcement to a group, provided you have permission to do so.
         *
         * @param headline - The title of the announcement
         * @param content - What the announcement says
         * @param hidden - True to post this as a hidden announcement. Default `false`.
         * @param callback - Called when the request completes
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        postAnnouncement(
            headline: string,
            content: string,
            hidden: boolean,
            callback: (err: Error | null) => void,
        ): void;

        /**
         * Edits an announcement in the group.
         *
         * @param announcementID - The ID of the announcement, as a string.
         * @param headline - The new title for the announcement.
         * @param content - The new content for the announcement.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        editAnnouncement(
            announcementID: string,
            headline: string,
            content: string,
            callback?: (err: Error | null) => void,
        ): void;

        /**
         * Deletes an announcement in the group.
         *
         * @param announcementID - The ID of the announcement, as a string
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        deleteAnnouncement(announcementID: string, callback?: (err: Error | null) => void): void;

        /**
         * Schedules a new event for the group.
         *
         * @param name - The event's name/headline
         * @param type - Can be `SteamCommunity.GroupEventType`, or an `AppID` to schedule a game-specific event.
         * @param description - A description for the event.
         * @param time - `null` to start it immediately, otherwise a `Date` object representing a time in the future.
         * @param server - If this is a game event (see below), this can be a string containing the game server's IP
         *   address or an object containing `ip` and `password` properties.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        scheduleEvent(
            name: string,
            type: GroupEventType | string,
            description: string,
            time: Date | null,
            server: string | object,
            callback?: (err: Error | null) => void,
        ): void;

        /**
         * Edits an existing Steam group event.
         *
         * @param id - The 64-bit numeric ID of the event you want to edit (as a string).
         * @param name - The event's name/headline.
         * @param type - Can be `SteamCommunity.GroupEventType`, or an `AppID` to schedule a game-specific event.
         * @param description - A description for the event.
         * @param time - `null` to start it immediately, otherwise a `Date` object representing a time in the future.
         * @param server - If this is a game event (see below), this can be a string containing the game server's IP
         *   address or an object containing `ip` and `password` properties.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        editEvent(
            id: string,
            name: string,
            type: GroupEventType | string,
            description: string,
            time: Date | null,
            server: string | object,
            callback?: (err: Error | null) => void,
        ): void;

        /**
         * Deletes an existing Steam group event.
         *
         * @param id - The 64-bit numeric ID of the event you want to delete.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        deleteEvent(id: string, callback?: (err: Error | null) => void): void;

        /**
         * Changes the group's current Player of the Week.
         *
         * @param steamID - A SteamID object representing the group's new Player of the Week
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         *   - `oldPOTW` - A `SteamID` representing the former Player of the Week.
         *   - `newPOTW` - A `SteamID` representing the new Player of the Week.
         */
        setPlayerOfTheWeek(
            steamID: SteamID,
            callback?: (err: Error | null, oldPOTW: SteamID, newPOTW: SteamID) => void,
        ): void;

        /**
         * Kicks a player from the group.
         *
         * @param steamID - A SteamID object representing the player to kick from the group
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        kick(steamID: SteamID, callback?: (err: Error | null) => void): void;

        /**
         * Requests a page of group history
         *
         * @param page - The page of history that you're requesting, starting at 1
         * @param callback - Called when requested data is available.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         *   - `history` - An object containing group history for this page.
         */
        getHistory(page: number, callback?: (err: Error | null, history: History) => void): void;

        /**
         * Gets a listing of comments in a Steam group.
         *
         * @param from - The offset where you want to start. 0 to start with the first (most recent) comment.
         * @param count - The number of comments you want to retrieve.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, or an `Error` object on failure.
         *   - `comments` - An array of comments object.
         */
        getAllComments(from: number, count: number, callback: (err: Error | null, comments: Comment[]) => void): void;

        /**
         * Deletes a comment in a Steam group, provided you have permission to do so (i.e. are the author or a group
         * moderator/admin with the appropriate permission).
         *
         * @param cid - The ID of the comment you want to delete
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        deleteComment(cid: string, callback: (err: Error | null) => void): void;

        /**
         * @param message
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        comment(message: string, callback?: (err: Error | null) => void): void;

        /**
         * Get requests to join a restricted group.
         *
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         *   - `requests` - array of SteamID objects.
         */
        getJoinRequests(callback: (err: Error | null, requests: SteamID[]) => void): void;

        /**
         * Respond to one or more join requests to a restricted group.
         *
         * @param steamIDs - The SteamIDs of the users you want to approve or deny membership for.
         * @param approve - True to put them in the group, false to deny their membership.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        respondToJoinRequests(
            steamIDs: SteamID | SteamID[] | string | string[],
            approve: boolean,
            callback?: (err: Error | null) => void,
        ): void;

        /**
         * Respond to all pending group-join requests for a particular group.
         *
         * @param approve - `True` to allow everyone who requested into the group, `false` to not.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        respondToAllJoinRequests(approve: boolean, callback?: (err: Error | null) => void): void;
    }

    class CSteamUser {
        /** A SteamID object containing the user's SteamID */
        steamID: SteamID;

        /** The user's current profile name (can be changed). */
        name: string;

        /** The user's current online state. One of `in-game`, `online`, or `offline`. */
        onlineState: 'in-game' | 'online' | 'offline';

        /** A message describing the user's current online state. Displayed on the profile below their status. */
        stateMessage: string;

        /** One of `public`, `friendsonly`, `private`. */
        privacyState: 'public' | 'friendsonly' | 'private';

        /** The user's visibility state relative to you, as an integer. `1` if visible, `0` if private. */
        visibilityState: number;

        /** The hash of the user's avatar. */
        avatarHash: string;

        /** `true` if the user has one or more VAC bans on record, `false` otherwise. */
        vacBanned: boolean;

        /** One of `None`, `Probation`, or `Banned`. */
        tradeBanState: 'None' | 'Probation' | 'Banned';

        /**
         * `true` if the user's account is
         * {@link https://support.steampowered.com/kb_article.php?ref=3330-IAGK-7663|limited}, `false` otherwise.
         */
        isLimitedAccount: boolean;

        /** The user's custom vanity URL. */
        customURL: string;

        /** A `Date` object for the user's account creation date (unavailable and `null` if private) */
        memberSince: Date | null;

        /** The user's given location (unavailable and `null` if private or not provided) */
        location: string | null;

        /** The user's given real name (unavailable and `null` if private or not provided) */
        realName: string | null;

        /** The user's profile summary (unavailable and `null` if private) */
        summary: string | null;

        /** An array of `SteamID` objects for the user's joined groups. */
        groups: SteamID[];

        /** A `SteamID` object for the user's chosen primary group */
        primaryGroup: SteamID;

        /**
         * Returns a URL where you can download this user's avatar image.
         *
         * @param size - One of small (default), medium, full.
         * @param protocol - One of http:// (default), https://, // (protocol aware).
         */
        getAvatarURL(size?: AvatarSizeType, protocol?: ProtocolType): string;

        /**
         * Adds the user as a friend.
         *
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        addFriend(callback?: (err: Error | null) => void): void;

        /**
         * Accepts a pending friend request from this user.
         *
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        acceptFriendRequest(callback?: (err: Error | null) => void): void;

        /**
         * Removes the user from your friends list.
         *
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        removeFriend(callback?: (err: Error | null) => void): void;

        /**
         * Blocks all communication with the user.
         *
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        blockCommunication(callback?: (err: Error | null) => void): void;

        /**
         * Removes the user from your blocked list.
         *
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        unblockCommunication(callback?: (err: Error | null) => void): void;

        /**
         * Attempts to post a comment on the user's profile. Fails if profile is private or you don't have permission to
         * post comments on the user's profile.
         *
         * @param message - The message to leave on the user's profile.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        comment(message: string, callback?: (err: Error | null) => void): void;

        /**
         * Attempts to invite the user to a Steam group. Fails if you're not friends with them.
         *
         * @param groupID - The SteamID of the group, as a SteamID object or a string which can be parsed into one.
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        inviteToGroup(groupID: SteamID, callback?: (err: Error | null) => void): void;

        /**
         * Gets a user's persona name history.
         *
         * @param callback - Called when requested data is available.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         *   - `aliases` - An array of objects for each of the user's 10 most recent name changes (including the current
         *       name) containing the following properties: ** `newname` - A string containing the user's new name. **
         *       `timechanged` - A `Date` object for when they adopted this name.
         */
        getAliases(callback: (err: Error | null, aliases: Aliase[]) => void): void;

        /**
         * Gets info about what inventories are available to a user. Calling this for your own logged-in account will
         * reset the number of new items you have to 0.
         *
         * @param callback - Called when the requested data is available.
         *
         *   - `err` - `null` on success, an `Error` object on failure
         *   - `apps` - An object whose keys are AppIDs and values are objects containing app and context data
         */
        getInventoryContexts(callback: (err: Error | null, apps: any) => void): void;

        /**
         * Gets the contents of a user's inventory.
         *
         * @param appID - The AppID of the app which owns the inventory you want to retrieve.
         * @param contextID - The ContextID of the context within the app you want to load.
         * @param tradableOnly - `true` to only get tradable items, `false` to get all.
         * @param callback - Called when requested data is available.
         *
         *   - `err` - `null` on success, an `Error` object on failure
         *   - `inventory` - An array containing
         *       {@link https://github.com/DoctorMcKay/node-steamcommunity/wiki/CEconItem|CEconItem} objects for the
         *       user's inventory items.
         *   - `currency` - An array containing
         *       {@link https://github.com/DoctorMcKay/node-steamcommunity/wiki/CEconItem|CEconItem} objects for the
         *       user's currency items.
         */
        getInventory(
            appID: number,
            contextID: number,
            tradableOnly: boolean,
            callback: (err: Error | null, inventory: CEconItem[], currencies: CEconItem[]) => void,
        ): void;

        /**
         * Get the contents of a user's inventory context.
         *
         * @param appID - The Steam application ID of the game for which you want an inventory
         * @param contextID - The ID of the "context" within the game you want to retrieve
         * @param tradableOnly - True to get only tradable items and currencies
         * @param callback
         */
        getInventoryContents(
            appID: number,
            contextID: number,
            tradableOnly: boolean,
            callback: (
                err: Error | null,
                inventory: CEconItem[],
                currency: string,
                count: number,
            ) => void,
        ): void;

        /**
         * Get the contents of a user's inventory context.
         *
         * @param appID - The Steam application ID of the game for which you want an inventory
         * @param contextID - The ID of the "context" within the game you want to retrieve
         * @param tradableOnly - True to get only tradable items and currencies
         * @param language - The language of item descriptions to return. Omit for default (which may either be English
         *   or your account's chosen language)
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        getInventoryContents(
            appID: number,
            contextID: number,
            tradableOnly: boolean,
            language: string,
            callback: (
                err: Error | null,
                inventory: CEconItem[],
                currency: string,
                count: number,
            ) => void,
        ): void;

        /**
         * Get the background URL of user's profile.
         *
         * @param callback
         */
        getProfileBackground(callback: (backgroundUrl: string) => void): void;

        /**
         * Upload an image to Steam and send it to the target user over chat.
         *
         * @param imageContentsBuffer - The image contents, as a Buffer
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        sendImage(imageContentsBuffer: Buffer, callback: (err: Error | null, url: string) => void): void;

        /**
         * Upload an image to Steam and send it to the target user over chat.
         *
         * @param imageContentsBuffer - The image contents, as a Buffer
         * @param options
         * @param callback - Called when the request completes.
         *
         *   - `err` - `null` on success, an `Error` object on failure.
         */
        sendImage(
            imageContentsBuffer: Buffer,
            options: { spoiler: boolean },
            callback: (err: Error | null, url: string) => void,
        ): void;
    }

    interface ItemHistory {
        type: string;
        data: Date;
        user: SteamID;
        actor?: SteamID;
    }

    interface History {
        first: number;
        last: number;
        total: number;
        items: ItemHistory[];
    }

    interface EconItemDescription {
        type: string;
        value?: string;
        color?: string;
        app_data?: string;
    }

    interface EconItemAction {
        link?: string;
        name?: string;
    }

    interface EconItemTag {
        internal_name: string;
        category: string;
        name?: string;
        localized_tag_name?: string;
        category_name?: string;
        localized_category_name?: string;
        color?: string;
    }

    interface Item {
        /** The item's unique ID within its app+context. */
        id?: string;

        /** The item's unique ID within its app+context. */
        assetid: string;

        /** The ID of the context within the app in which the item resides. */
        contextid: string;
        currencyid?: string;

        /** The ID of the app which owns the item. */
        appid: number;

        /** The first half of the item cache identifier. The classid is enough to get you basic details about the item. */
        classid?: string;

        /** The second half of the item cache identifier. */
        instanceid?: string;

        /** How much of this item is in this stack. */
        amount: number;

        /**
         * The item's position within the inventory (starting at 1). Not defined if this item wasn't retrieved directly
         * from an inventory (e.g. from a trade offer or inventory history).
         */
        pos?: number;

        /** The item's display name. */
        name?: string;

        /** The item's universal market name. This identifies the item's market listing page. */
        market_hash_name?: string;

        /** The render color of the item's name, in hexadecimal. */
        name_color?: string;

        /** The displayed background color, in hexadecimal. */
        background_color?: string;

        /** The "type" that's shown under the game name to the right of the game icon. */
        type?: string;

        /** `true` if the item can be traded, `false` if not. */
        tradable?: boolean;

        /** `true` if the item can be listed on the Steam Community Market, `false` if not. */
        marketable?: boolean;

        /** `true` if, on the Steam Community Market, this item will use buy orders. `false` if not. */
        commodity?: boolean;

        /** How many days for which the item will be untradable after being sold on the market. */
        market_tradable_restriction?: number;

        /** How many days for which the item will be unmarketable after being sold on the market. */
        market_marketable_restriction?: number;

        /** An array of objects containing information about the item. Displayed under the item's `type`. */
        descriptions?: EconItemDescription[];
        owner_descriptions?: EconItemDescription[];
        actions?: EconItemAction[];
        owner_actions?: EconItemAction[];
        market_actions?: any[];

        /**
         * An array of strings containing "fraud warnings" about the item. In inventories and trades, items with fraud
         * warnings have a red (!) symbol, and fraud warnings are displayed in red under the item's name.
         */
        fraudwarnings?: string[];

        /** An array of objects containing the item's inventory tags. */
        tags?: Tag[];

        /** Not always present. An object containing arbitrary data as reported by the game's item server. */
        app_data?: any;
    }

    interface Aliase {
        newname: string;
        timechanged: Date;
    }

    interface Comment {
        authorName: string;
        authorId: string;
        date: string;
        commentId: string;
        text: string;
    }

    interface Tag {
        internal_name: string;
        name: string;
        category: string;
        color: string;
        category_name: string;
    }

    interface Options {
        /**
         * An instance of {@link https://www.npmjs.com/package/request|request} v2.x.x which will be used by
         * `SteamCommunity` for its HTTP requests. `SteamCommunity` will create its own if omitted.
         */
        request: Request;

        /**
         * The time in milliseconds that `SteamCommunity` will wait for HTTP requests to complete. Defaults to `50000`
         * (50 seconds). Overrides any `timeout` option that was set on the passed-in `request` object.
         */
        timeout: number;

        /**
         * The user-agent value that `SteamCommunity` will use for its HTTP requests. Defaults to Chrome v47's
         * user-agent. Overrides any `headers['User-Agent']` option that was set on the passed-in `request` object.
         */
        userAgent: string;

        /**
         * The local IP address that `SteamCommunity` will use for its HTTP requests. Overrides an `localAddress` option
         * that was set on the passed-in `request` object.
         */
        localAddress: string;
    }

    interface LoginOptions {
        accountName: string;
        password: string;
        steamguard?: string;
        authCode?: string;
        twoFactorCode?: string;
        captcha?: string;
        disableMobile?: boolean;
    }

    interface Notifications {
        comments: number;
        items: number;
        invites: number;
        gifts: number;
        chat: number;
        trades: number;
        gameTurns: number;
        moderatorMessages: number;
        helpRequestReplies: number;
        accountAlerts: number;
    }

    interface MarketSearchOptions {
        query: string;
        appid: string;
        searchDescriptions: boolean;
    }

    interface EditProfileSettings {
        name: string;
        realName: string;
        summary: any;
        country: string;
        state: string;
        city: string;
        customURL: string;
        background: string;
        featuredBadge: string;
        primaryGroup: SteamID;
    }

    enum PrivacyState {
        Invalid = 0,
        Private = 1,
        FriendsOnly = 2,
        Public = 3,
    }

    interface Announcement {
        headline: string;
        content: string;
        date: Date;
        author: string;
        aid: string;
    }

    interface ProfileSetting {
        profile: PrivacyState;
        comments: PrivacyState;
        inventory: PrivacyState;
        inventoryGifts: boolean;
    }

    interface InventoryHistoryOptions {
        direction: 'past' | 'future';
        startTime: Date;
        startTrade: any;
        resolveVanityURLs: boolean;
    }

    interface TradeHistory {
        onHold: boolean;
        date: Date;
        partnerName: string;
        partnerSteamID: SteamID;
        partnerVanityURL: string;
        itemsReceived: CEconItem[];
        itemsGiven: CEconItem[];
    }

    interface InventoryHistory {
        firstTradeTime: number;
        firstTradeID: number;
        lastTradeTime: number;
        lastTradeID: number;
        trades: TradeHistory[];
    }

    interface EnableTwoFactorResponse {
        status: number;
        shared_secret: string;
        identity_secret: string;
        revocation_code: string;
    }

    enum ChatState {
        Offline = 0,
        LoggingOn = 1,
        LogOnFailed = 2,
        LoggedOn = 3,
    }

    enum ConfirmationType {
        Trade = 2,
        MarketListing = 3,
    }

    enum PersonaState {
        Offline = 0,
        Online = 1,
        Busy = 2,
        Away = 3,
        Snooze = 4,
        LookingToTrade = 5,
        LookingToPlay = 6,
        Max = 7,
    }

    enum PersonaStateFlag {
        HasRichPresence = 1,
        InJoinableGame = 2,
        ClientTypeWeb = 256,
        ClientTypeMobile = 512,
        ClientTypeTenfoot = 1024,
        ClientTypeVR = 2048,
        LaunchTypeGamepad = 4096,
    }

    enum EResult {
        Invalid = 0,
        OK = 1,
        Fail = 2,
        NoConnection = 3,
        InvalidPassword = 5,
        LoggedInElsewhere = 6,
        InvalidProtocolVer = 7,
        InvalidParam = 8,
        FileNotFound = 9,
        Busy = 10,
        InvalidState = 11,
        InvalidName = 12,
        InvalidEmail = 13,
        DuplicateName = 14,
        AccessDenied = 15,
        Timeout = 16,
        Banned = 17,
        AccountNotFound = 18,
        InvalidSteamID = 19,
        ServiceUnavailable = 20,
        NotLoggedOn = 21,
        Pending = 22,
        EncryptionFailure = 23,
        InsufficientPrivilege = 24,
        LimitExceeded = 25,
        Revoked = 26,
        Expired = 27,
        AlreadyRedeemed = 28,
        DuplicateRequest = 29,
        AlreadyOwned = 30,
        IPNotFound = 31,
        PersistFailed = 32,
        LockingFailed = 33,
        LogonSessionReplaced = 34,
        ConnectFailed = 35,
        HandshakeFailed = 36,
        IOFailure = 37,
        RemoteDisconnect = 38,
        ShoppingCartNotFound = 39,
        Blocked = 40,
        Ignored = 41,
        NoMatch = 42,
        AccountDisabled = 43,
        ServiceReadOnly = 44,
        AccountNotFeatured = 45,
        AdministratorOK = 46,
        ContentVersion = 47,
        TryAnotherCM = 48,
        PasswordRequiredToKickSession = 49,
        AlreadyLoggedInElsewhere = 50,
        Suspended = 51,
        Cancelled = 52,
        DataCorruption = 53,
        DiskFull = 54,
        RemoteCallFailed = 55,
        PasswordUnset = 56,
        ExternalAccountUnlinked = 57,
        PSNTicketInvalid = 58,
        ExternalAccountAlreadyLinked = 59,
        RemoteFileConflict = 60,
        IllegalPassword = 61,
        SameAsPreviousValue = 62,
        AccountLogonDenied = 63,
        CannotUseOldPassword = 64,
        InvalidLoginAuthCode = 65,
        AccountLogonDeniedNoMail = 66,
        HardwareNotCapableOfIPT = 67,
        IPTInitError = 68,
        ParentalControlRestricted = 69,
        FacebookQueryError = 70,
        ExpiredLoginAuthCode = 71,
        IPLoginRestrictionFailed = 72,
        AccountLockedDown = 73,
        AccountLogonDeniedVerifiedEmailRequired = 74,
        NoMatchingURL = 75,
        BadResponse = 76,
        RequirePasswordReEntry = 77,
        ValueOutOfRange = 78,
        UnexpectedError = 79,
        Disabled = 80,
        InvalidCEGSubmission = 81,
        RestrictedDevice = 82,
        RegionLocked = 83,
        RateLimitExceeded = 84,
        AccountLoginDeniedNeedTwoFactor = 85,
        ItemDeleted = 86,
        AccountLoginDeniedThrottle = 87,
        TwoFactorCodeMismatch = 88,
        TwoFactorActivationCodeMismatch = 89,
        AccountAssociatedToMultiplePartners = 90,
        NotModified = 91,
        NoMobileDevice = 92,
        TimeNotSynced = 93,
        SMSCodeFailed = 94,
        AccountLimitExceeded = 95,
        AccountActivityLimitExceeded = 96,
        PhoneActivityLimitExceeded = 97,
        RefundToWallet = 98,
        EmailSendFailure = 99,
        NotSettled = 100,
        NeedCaptcha = 101,
        GSLTDenied = 102,
        GSOwnerDenied = 103,
        InvalidItemType = 104,
        IPBanned = 105,
        GSLTExpired = 106,
        InsufficientFunds = 107,
        TooManyPending = 108,
        NoSiteLicensesFound = 109,
        WGNetworkSendExceeded = 110,
        AccountNotFriends = 111,
        LimitedUserAccount = 112,
    }

    interface Persona {
        steamID: SteamID;
        personaName: string;
        personaState: PersonaState;
        personaStateFlags: PersonaStateFlag;
        avatarHash: string;
        inGame: boolean;
        inGameAppID: number;
        inGameName: string | null;
    }

    interface GiftDetails {
        giftName: string;
        packageID: number;
        owned: boolean;
    }

    interface TokenDetails {
        steamID: SteamID;
        accountName: string;
        webLogonToken: string;
    }

    interface EventListener {
        /**
         * Emitted when a new confirmation is received. This will be emitted once per confirmation.
         *
         * @deprecated The confirmation checker is deprecated and will be removed in a future release.
         * @param confirmation - A `CConfirmation` object.
         */
        newConfirmation: (confirmation: CConfirmation) => void;

        /**
         * Emitted when the automatic confirmation checker auto-accepts a confirmation with success.
         *
         * @deprecated The confirmation checker is deprecated and will be removed in a future release.
         * @param confirmation - A `CConfirmation` object.
         */
        confirmationAccepted: (confirmation: CConfirmation) => void;

        /**
         * Emitted when there's a problem while logging into webchat.
         *
         * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
         * @param err - An `Error` object.
         * @param fatal - `true` if this is a fatal error, `false` if not (will keep trying to connect if not fatal).
         */
        chatLogOnFailed: (err: Error, fatal: boolean) => void;

        /**
         * Emitted in response to a call to `chatLogon()` when we successfully logged on.
         *
         * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
         */
        chatLoggedOn: () => void;

        /**
         * Emitted when we receive new persona state data for a friend.
         *
         * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
         * @param steamID - The SteamID of the user for whom we just got persona data, as a `SteamID` object.
         * @param persona - The user's persona data.
         */
        chatPersonaState: (steamID: SteamID, persona: Persona) => void;

        /**
         * Emitted when we receive a new chat message.
         *
         * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
         * @param sender - The sender's SteamID, as a `SteamID` object.
         * @param text - The message text.
         */
        chatMessage: (sender: SteamID, text: string) => void;

        /**
         * Emitted when we receive a notification that someone is typing a message.
         *
         * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
         * @param callback - `sender` - The sender's SteamID, as a `SteamID` object
         */
        chatTyping: (sender: SteamID) => void;

        /**
         * Emitted in response to a `chatLogoff()` call when we successfully logged off.
         *
         * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
         */
        chatLoggedOff: () => void;

        /**
         * Emitted when an HTTP request is made which requires a login, and Steam redirects us to the login page (i.e.
         * we aren't logged in). You should re-login when you get this event.
         *
         * @param err - An Error object.
         */
        sessionExpired: (err: Error) => void;

        /**
         * This event will be emitted when the confirmation checker needs a new confirmation key to continue. Keys that
         * can be reused will be saved for up to five minutes before they are requested again.
         *
         * @deprecated The confirmation checker is deprecated and will be removed in a future release.
         * @param tag - The tag that should be used to generate this key.
         * @param callback - You should call this function when you have the key ready.
         *
         *   - `err` - If an error occurred when you were getting the key, pass an `Error` object here and no further
         *       arguments. If successful, pass `null` here.
         *   - `time` - The Unix timestamp that you used to generate this key.
         *   - `key` - The base64 string key.
         */
        confKeyNeeded: (tag: string, callback: (err: Error | null, time: number, key: string) => void) => void;
    }
}

declare class SteamCommunity extends EventEmitter {
    constructor(options?: SteamCommunity.Options);

    on<T extends keyof SteamCommunity.EventListener>(event: T, listener: SteamCommunity.EventListener[T]): any;

    /**
     * @param details - An object containing our login details.
     * @param callback - A function which will be called once we're logged in.
     *
     *   - `err` - If an error occurred, this is an `Error` object. Some common failures:
     *   - `sessionID` - Your session ID value. If you're using an external library, it'll know what to do with this.
     *       Otherwise, you can ignore it.
     *   - `cookies` - An array containing your cookies. If you're using an external library, you'll need these. Otherwise,
     *       you can ignore them.
     *   - `steamguard` - If your account is protected by Steam Guard, this is a string which can be passed to `login` as
     *       the `steamguard` property of `details`. You should treat it as an opaque string, but currently it's
     *       `YourSteamID||YourCookieValue`. You can pull `YourCookieValue` from the value of the
     *       `steamMachineAuthYourSteamID` cookie on an authorized browser if you wish.
     *   - `oAuthToken` - An oAuth token. You can use this value along with the `steamguard` value with `oAuthLogin` for
     *       subsequent passwordless logins.
     */
    login(
        details: SteamCommunity.LoginOptions,
        callback: (err: Error | null, sessionID: string, cookies: any, steamguard: string, oAuthToken: string) => void,
    ): void;

    /**
     * Facilitates passwordless login using details received from a previous login request.
     *
     * @param steamguard - The `steamguard` value from the callback of `login`.
     * @param oAuthToken - The `oAuthToken` value from the callback of `login`.
     * @param callback - Called when the login request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `sessionID` - Your `sessionid` value. If an external library prompts for it, you'll need this. Otherwise, you can
     *       safely ignore it.
     *   - `cookies` - An array containing your cookies. If you're using an external library, you'll need these. Otherwise,
     *       you can ignore them.
     */
    oAuthLogin(
        steamguard: string,
        oAuthToken: string,
        callback: (err: Error | null, sessionID: string, cookies: any) => void,
    ): void;

    /**
     * Use this method to check whether or not you're currently logged into Steam and what your Family View status is.
     *
     * @param callback - Called when the result is available. Has three arguments:
     *
     *   - Err - If an error occurred, this is an `Error` object. Otherwise, `null`.
     *   - LoggedIn - `true` if you're currently logged in, `false` otherwise
     *   - FamilyView - `true` if you're currently in family view, `false` otherwise. If `true`, you'll need to call
     *       `parentalUnlock` with the correct PIN before you can do anything.
     */
    loggedIn(callback: (err: Error | null, loggedIn: boolean, familyView: boolean) => void): void;

    /**
     * Use this to resume a previous session or to use a session that was negotiated elsewhere (using
     * {@link https://github.com/DoctorMcKay/node-steam-user|node-steam-user}, for instance).
     *
     * @param cookies - An array of cookies (as `name=value` pair strings)
     */
    setCookies(cookies: string[]): void;

    /** Returns the session ID of your current session, or generates a new one if you don't have a session yet. */
    getSessionID(): number;

    /**
     * Retrieves your account's {@link https://steamcommunity.com/dev/apikey|Web API key}, and registers one if needed.
     * Usage of this method constitutes agreement to the
     * {@link https://steamcommunity.com/dev/apiterms|Steam Web API terms of use}.
     *
     * @param domain - A domain name to associate with your key.
     * @param callback - A function to be called once the key is obtained.
     *
     *   - `err` - If an error occurred, this is an `Error` object. The `message` property will be `Access Denied` if you
     *       attempt to retrieve an API key on a limited account.
     *   - `key` - Your API key on success.
     */
    getWebApiKey(domain: string, callback: (err: Error | null, key: string) => void): void;

    /**
     * Gets an oauth access token for those WebAPI methods that need one.
     *
     * @deprecated No longer works if not logged in via mobile login. Will be removed in a future release.
     * @param callback - A function to be called once the token is obtained.
     *
     *   - `err` - If an error occurred, this is an `Error` object.
     *   - `token` - Your oauth token on success.
     */
    getWebApiOauthToken(callback: (err: Error | null, token: string) => void): void;

    /**
     * Retrieves a token that can be used to log on via {@link https://www.npmjs.com/package/steam-user|node-steam-user}.
     *
     * @param callback - A function to be called once the token is obtained.
     *
     *   - `err` - If an error occurred, this is an Error object.
     *   - `details` - An object containing these properties: ** `steamID` - Your account's SteamID, as a SteamID object. **
     *       `accountName` - Your account's logon name. ** `webLogonToken` - Your logon token.
     */
    getClientLogonToken(callback: (err: Error | null, details: SteamCommunity.TokenDetails) => void): void;

    /**
     * If your account has Family View enabled, calling this will disable it for your current session.
     *
     * @param pin - Your 4-digit Family View PIN.
     * @param callback - An callback to be invoked on completion
     *
     *   - Err - If an error occurred, an `Error` object. `null` otherwise. If your PIN was wrong, the `message` property
     *       will be `Incorrect PIN`.
     */
    parentalUnlock(pin: string, callback?: (err: Error | null, message: string) => void): void;

    /**
     * Gets your account's notifications.
     *
     * @param callback - Fired when the requested data is available.
     *
     *   - `err` - `null` on success, or an `Error` object on failure.
     *   - `notifications` - An object containing properties for each notification type.
     */
    getNotifications(callback: (err: Error | null, notifications: SteamCommunity.Notifications) => void): void;

    /**
     * Loads your inventory page, which resets your new items notification to 0.
     *
     * @param callback - An callback to be invoked on completion.
     *
     *   - `err` - An Error object on failure, null on success.
     */
    resetItemNotifications(callback?: (err: Error | null) => void): void;

    /**
     * Gets your account's trade URL, which can be used by people who aren't your friends on Steam to send you trade offers.
     *
     * @param callback - A callback to be invoked on completion.
     *
     *   - `err` - An `Error` object on failure, `null` on success.
     *   - `url` - Your full trade URL.
     *   - `token` - Just the `token` parameter from your trade URL.
     */
    getTradeURL(callback: (err: Error | null, url: string, token: string) => void): void;

    /**
     * Invalidates your account's existing trade URL and generates a new token, which is returned in the callback.
     *
     * @param callback - A callback to be invoked on completion.
     *
     *   - `err` - An `Error` object on failure, `null` on success.
     *   - `url` - Your new full trade URL.
     *   - `token` - Just the `token` parameter from your new trade URL.
     */
    changeTradeURL(callback?: (err: Error | null, url: string, token: string) => void): void;

    /**
     * Clears your Steam profile name history (aliases).
     *
     * @param callback - A callback to be invoked on completion.
     *
     *   - `err` - An `Error` object on failure, `null` on success.
     */
    clearPersonaNameHistory(callback?: (err: Error | null) => void): void;

    /**
     * Creates and returns a `CSteamUser` object for a particular user.
     *
     * @param id - Either a `SteamID` object or a user's ID.
     * @param callback - Called when the user's data is loaded and ready.
     *
     *   - `err` - If an error occurred, this is an `Error` object. `null` otherwise.
     *   - `user` - A `SteamCommunity.CSteamUser` instance.
     */
    getSteamUser(id: SteamID | string, callback: (err: Error | null, user: SteamCommunity.CSteamUser) => void): void;

    /**
     * Creates and returns a `CSteamGroup` object for a particular group.
     *
     * @param id - Either a SteamID object or a group's URL (the part after `/groups/`)
     * @param callback - Called when the group's data is loaded and ready
     *
     *   - `err` - If an error occurred, this is an `Error` object
     *   - `group` - A `SteamCommunity.CSteamGroup` instance
     */
    getSteamGroup(id: SteamID | string, callback: (err: Error | null, group: SteamCommunity.CSteamGroup) => void): void;

    /**
     * Requests a list of all apps which support the Steam Community Market.
     *
     * @param callback - Called when the requested data is available.
     *
     *   - `err` - `null` on success, or an `Error` object on failure.
     *   - `apps` - An object whose keys are AppIDs and whose values are the names of the apps.
     */
    getMarketApps(callback: (err: Error | null, apps: object) => void): void;

    /**
     * Creates and returns a `CMarketItem` object for a particular item.
     *
     * @param appid - The ID of the app to which this item belongs.
     * @param hashName - The item's `market_hash_name`.
     * @param callback - Called when the item data is loaded and ready.
     *
     *   - `err` - If an error occurred, this is an `Error` object. If the item is not on the market or doesn't exist, the
     *       `message` property will be `There are no listings for this item`.
     *   - `item` - A `CMarketItem` instance.
     */
    getMarketItem(
        appid: string,
        hashName: string,
        callback: (err: Error | null, item: SteamCommunity.CMarketItem) => void,
    ): void;

    /**
     * Searches the market for a particular query.
     *
     * @param options - Provide a string to just search for that string, otherwise an object with one or more of the
     *   following properties:
     *
     *   - `query` - The query string to search for.
     *   - `appid` - The `AppID` of the game you're searching for.
     *   - `searchDescriptions` - `true` to also search in the descriptions of items (takes longer to search), `false` or
     *       omitted otherwise.
     *
     * @param callback - Called when results are available.
     *
     *   - `err` - If an error occurred, this will be an `Error` object. If the item is not on the market or doesn't exist,
     *       the message property will be` There were no items matching your search. Try again with different keywords`.
     *   - `items` - An array of `CMarketSearchResult` instances.
     */
    marketSearch(
        options: SteamCommunity.MarketSearchOptions,
        callback: (err: Error | null, items: SteamCommunity.CMarketSearchResult[]) => void,
    ): void;

    /**
     * If your Steam account is new and your profile isn't set up yet, you can call this to create it.
     *
     * @param callback - Called when the action is complete
     *
     *   - Err - `null` on success, or an `Error` object on failure
     */
    setupProfile(callback?: (err: Error | null) => void): void;

    /**
     * Updates one or more parts of your profile.
     *
     * @param settings - An object containing one or more of the following properties.
     *
     *   - `name` - Your new profile name.
     *   - `realName` - Your new profile "real name", or empty string to remove it.
     *   - `summary` - Your new profile summary.
     *   - `country` - A country code, like `US`, or empty string to remove it.
     *   - `state` - A state code, like `FL`, or empty string to remove it.
     *   - `city` - A numeric city code, or empty string to remove it.
     *   - `customURL` - Your new profile custom URL.
     *   - `background` - The assetid of an owned profile background which you want to equip, or empty string to remove it.
     *   - `featuredBadge` - The ID of your new featured badge, or empty string to remove it. Currently game badges aren't
     *       supported, only badges whose pages end in `/badge/<id>`.
     *   - `primaryGroup` - A `SteamID` object for your new primary Steam group, or a string which can parse into a `SteamID`.
     *
     * @param callback - Called when the request completes.
     *
     *   - Err - `null` on success, or an `Error` object on failure
     */
    editProfile(settings: SteamCommunity.EditProfileSettings, callback?: (err: Error | null) => void): void;

    /**
     * Updates one or more parts of your profile settings.
     *
     * @param settings- An object containing one or more of the following properties.
     *
     *   - `profile` - A value from `SteamCommunity.PrivacyState` for your desired profile privacy state.
     *   - `comments` - A value from `SteamCommunity.PrivacyState` for your desired profile comments privacy state.
     *   - `inventory` - A value from `SteamCommunity.PrivacyState` for your desired inventory privacy state.
     *   - `inventoryGifts` - `true` to keep your Steam gift inventory private, `false` otherwise.
     *   - `gameDetails` - A value from `SteamCommunity.PrivacyState` for your desired privacy level required to view games
     *       you own and what game you're currently playing.
     *   - `playtime` - `true` to keep your game playtime private, `false` otherwise.
     *   - `friendsList` - A value from `SteamCommunity.PrivacyState` for your desired privacy level required to view your
     *       friends list.
     *
     * @param callback - Called when the request completes.
     *
     *   - Err - `null` on success, or an `Error` object on failure
     */
    profileSettings(settings: SteamCommunity.ProfileSetting, callback?: (err: Error | null) => void): void;

    /**
     * Replaces your current avatar image with a new one.
     *
     * @param image - A `Buffer` containing the image, a string containing a URL to the image, or a string containing
     *   the path to the image on the local disk.
     * @param format - The format of the image.
     * @param callback - Called when the upload is complete or fails.
     *
     *   - `err` - An `Error` object on failure or `null` on success.
     *   - `url` - The URL to the new image on Steam's CDN.
     */
    uploadAvatar(
        image: Buffer | string,
        format?: SteamCommunity.ImageFormat,
        callback?: (err: Error | null, url: string) => void,
    ): void;

    /**
     * Posts a status update to your profile feed.
     *
     * @param statusText - A string containing your new status update's content
     * @param callback - Called when request completes.
     *
     *   - `err` - An `Error` object on failure or `null` on success.
     *   - `postID` - The ID of this new post.
     */
    postProfileStatus(statusText: string, callback: (err: Error | null, postID: number) => void): void;

    /**
     * Posts a status update to your profile feed.
     *
     * @param statusText - A string containing your new status update's content
     * @param options - An object containing zero or more of the following properties:
     *
     *   - `appID` - An integer appID if you want this status update to be tagged with a specific game.
     *
     * @param callback - Called when request completes.
     *
     *   - `err` - An `Error` object on failure or `null` on success.
     *   - `postID` - The ID of this new post.
     */
    postProfileStatus(statusText: string, options: object, callback: (err: Error | null, postID: number) => void): void;

    /**
     * Removes a status update from your profile feed.
     *
     * @param postID - The ID of the post you want to delete
     * @param callback - Called when request completes.
     *
     *   - `err` - An `Error` object on failure or `null` on success.
     */
    deleteProfileStatus(postID: number, callback?: (err: Error | null) => void): void;

    /**
     * Gets a page of trades from your inventory history.
     *
     * @param callback - Called when the requested data is available.
     *
     *   - `err` - An `Error` object on failure, or `null` if success.
     *   - `history` - An object containing the data on the requested history page.
     */
    getInventoryHistory(callback: (err: Error | null, history: SteamCommunity.InventoryHistory) => void): void;

    /**
     * Gets a page of trades from your inventory history.
     *
     * @param options
     * @param callback - Called when the requested data is available.
     *
     *   - `err` - An `Error` object on failure, or `null` if success.
     *   - `history` - An object containing the data on the requested history page.
     */
    getInventoryHistory(
        options: SteamCommunity.InventoryHistoryOptions,
        callback: (err: Error | null, history: SteamCommunity.InventoryHistory) => void,
    ): void;

    /**
     * Starts the process to turn on TOTP for your account.
     *
     * @param callback - Called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `response` - The entire response from Steam.
     */
    enableTwoFactor(callback: (err: Error | null, response: SteamCommunity.EnableTwoFactorResponse) => void): void;

    /**
     * Finishes the process of enabling TOTP two-factor authentication for your account.
     *
     * @param shared_secret - `shared_secret` that you received in enableTwoFactor response.
     * @param activationCode - The activation code you received in your SMS.
     * @param callback - Called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     */
    finalizeTwoFactor(shared_secret: string, activationCode: string, callback: (err: Error | null) => void): void;

    /**
     * Disables two-factor authentication on your account given a revocation code.
     *
     * @param revocationCode - Your two-factor revocation code.
     * @param callback - Called when the request completes
     *
     *   - `err` - An `Error` object on failure, or `null` on success. In some failures, there may be an `EResult` property defined.
     */
    disableTwoFactor(revocationCode: string, callback: (err: Error | SteamCommunity.EResult | null) => void): void;

    /**
     * Get your account's outstanding confirmations.
     *
     * @param time - The Unix timestamp with which the following key was generated.
     * @param key - The confirmation key that was generated using the preceeding time and the tag "conf".
     * @param callback - Called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `confirmations` - An array of `CConfirmation` objects.
     */
    getConfirmations(
        time: number,
        key: string,
        callback: (err: Error | null, confirmations: SteamCommunity.CConfirmation[]) => void,
    ): void;

    /**
     * Gets the ID of the trade offer that this confirmation is confirming, if it's for a trade.
     *
     * @param confID -The confirmation's ID.
     * @param time - The Unix timestamp with which the following key was generated.
     * @param key - The confirmation key that was generated using the preceeding time and the tag "details" (this key
     *   can be reused). You can use {@link https://www.npmjs.com/package/steam-totp|steam-totp} to generate this.
     * @param callback - Called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `offerID` - The ID of the trade offer this is confirming, or null if not a confirmation for a trade offer.
     */
    getConfirmationOfferID(
        confID: string,
        time: number,
        key: string,
        callback: (err: Error | null, offerId: string) => void,
    ): void;

    /**
     * @param confID - The ID of the confirmation in question, or an array of confirmation IDs
     * @param confKey - The confirmation key associated with the confirmation in question
     * @param time - The unix timestamp with which the following key was generated
     * @param key - The confirmation key that was generated using the preceding time and the tag "allow" (if accepting)
     *   or "cancel" (if not accepting)
     * @param accept - True if you want to accept the confirmation, false if you want to cancel it
     * @param callback - Called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     */
    respondToConfirmation(
        confID: number | number[],
        confKey: string | string[],
        time: number,
        key: string,
        accept: boolean,
        callback: (err: Error | null) => void,
    ): void;

    /**
     * @param identitySecret - Your account's identity_secret.
     * @param objectID - The ID of the thing you want to confirm.
     * @param callback - Called when the task completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     */
    acceptConfirmationForObject(
        identitySecret: string,
        objectID: number | string,
        callback: (err: Error | null) => void,
    ): void;

    /**
     * Accept all outstanding confirmations on your account all at once.
     *
     * @param time - Should be a unix timestamp.
     * @param confKey - Should be a base64-encoded key for the "conf" tag, generated using the supplied time
     * @param allowKey - Should be a base64-encoded key for the "allow" tag, generated using the supplied time
     * @param callback - Called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `confs` - An array of the confirmations that were just accepted. May be empty if there were no pending confirmations.
     */
    acceptAllConfirmations(
        time: number,
        confKey: string,
        allowKey: string,
        callback: (err: Error | null, confs: SteamCommunity.CConfirmation[] | any[]) => void,
    ): void;

    /**
     * Use this method to see how many gems you'd get if you gemified a Steam Community item.
     *
     * @param appid - The AppID of the game to which the item in question belongs.
     * @param assetid - The AssetID of the item in question.
     * @param callback - A function to be called when the requested data is available.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `res` - An object containing these properties: ** `promptTitle` - A string containing the title which goes in the
     *       prompt shown in the Steam UI, e.g. "Turn into gems?" ** `gemValue` - How many gems you'd get if you
     *       gemified this item.
     */
    getGemValue(
        appid: number,
        assetid: string | number,
        callback: (err: Error | null, res: { promptTitle: string; gemValue: number }) => void,
    ): void;

    /**
     * Gemify a Steam Community item.
     *
     * @param appid - The AppID of the game to which the item in question belongs.
     * @param assetid - The AssetID of the item in question.
     * @param expectedGemsValue - How many gems you should get for this item (from `getGemValue`).
     * @param callback - A function to be called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `res` - An object containing these properties: ** `gemsReceived` - How many gems you got for this item. **
     *       `totalGems` - How many gems you have now.
     */
    turnItemIntoGems(
        appid: number,
        assetid: number | string,
        expectedGemsValue: number,
        callback: (err: Error | null, res: { gemsReceived: number; totalGems: number }) => void,
    ): void;

    /**
     * Packs some gems into sacks.
     *
     * @param assetid - ID of gem stack you want to pack into sacks.
     * @param desiredSackCount - How many sacks you want. You must have at least this amount * 1000 gems in the stack
     *   you're packing.
     * @param callback - A function to be called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     */
    packGemSacks(assetid: number | string, desiredSackCount: number, callback: (err: Error | null) => void): void;

    /**
     * Unpacks a booster pack in your inventory.
     *
     * @param assetid - The AppID of the game to which the booster pack in question belongs.
     * @param sacksToUnpack - The AssetID of the booster pack in question.
     * @param callback - A function to be called when the request completes.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     */
    unpackGemSacks(assetid: number | string, sacksToUnpack: number, callback: (err: Error | null) => void): void;

    /**
     * Get details about a gift in your Steam Gifts inventory.
     *
     * @param giftID - A string containing the assetid of the gift in your inventory.
     * @param callback - A function to be called when the requested data is available.
     *
     *   - `err` - An `Error` object on failure, or `null` on success.
     *   - `res` - An object containing these properties: ** `giftName` - The name of this gift. ** `packageID` - The ID of
     *       the Steam package that you'll be granted if you redeem this gift. ** `owned` - A bool indicating whether
     *       your account already owns this package.
     */
    getGiftDetails(giftID: string, callback: (err: Error | null, res: SteamCommunity.GiftDetails) => void): void;

    /**
     * Redeem a gift in your Steam Gifts inventory and add it to your library.
     *
     * @param giftID - A string containing the assetid of the gift in your inventory.
     * @param callback - A function to be called when the request completes.
     *
     *   - Err - An `Error` object on failure, or `null` on success.
     */
    redeemGift(giftID: string, callback: (err: Error | null) => void): void;

    /**
     * Start automatically polling our confirmations for new ones.
     *
     * @param pollInterval - The interval, in milliseconds, at which we will poll for confirmations. This should
     *   probably be at least `10,000` to avoid rate-limits.
     * @param identitySecret - Your `identity_secret`. If passed, all confirmations will be automatically accepted and
     *   nothing will be emitted.
     */
    startConfirmationChecker(pollInterval: number, identitySecret?: Buffer | string | null): void;

    /**
     * Stop automatically polling our confirmations.
     *
     * @deprecated The confirmation checker is deprecated and will be removed in a future release.
     */
    stopConfirmationChecker(): void;

    /**
     * Run the confirmation checker right now instead of waiting for the next poll.
     *
     * @deprecated The confirmation checker is deprecated and will be removed in a future release.
     */
    checkConfirmations(): void;

    /**
     * Starts logging you into web chat.
     *
     * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
     * @param interval - The interval in milliseconds between polling requests (default `500`).
     * @param uiMode - Web to get a globe icon next to your name, mobile to get a phone icon (default `web`).
     */
    chatLogon(interval?: number, uiMode?: 'web' | 'mobile'): void;

    /**
     * Sends a chat message to a recipient.
     *
     * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
     * @param recipientId - The recipient of our message, as a SteamID object or something that can parse into a SteamID
     *   object (STEAM_0:0:23071901, [U:1:46143802], or 76561198006409530 formats)
     * @param text - The message text.
     * @param type - The type of message you're sending.
     * @param callback - Called when the request completes.
     *
     *   - `err` - `null` on success, an `Error` object on failure.
     */
    chatMessage(
        recipientId: SteamID | string,
        text: string,
        type?: 'saytext' | 'typing',
        callback?: (err: Error | null) => void,
    ): void;

    /**
     * Logs you off of chat.
     *
     * @deprecated `WEBCHAT` via `NODE-STEAMCOMMUNITY` is deprecated and will be removed in a future release.
     */
    chatLogoff(): void;
}

export = SteamCommunity;
