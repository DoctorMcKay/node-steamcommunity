/* eslint-disable */
// Auto-generated by generate-protos script on Sun Aug 28 2022 18:52:02 GMT-0400 (Eastern Daylight Time)

///////////////////////////////////////////////
// enums.proto
///////////////////////////////////////////////

/**
 * @typedef {object} Proto_CMsgIPAddress
 * @property {number} [v4]
 * @property {Buffer} [v6]
 */

/**
 * @typedef {object} Proto_CMsgIPAddressBucket
 * @property {Proto_CMsgIPAddress} [original_ip_address]
 * @property {string} [bucket]
 */

/**
 * @typedef {object} Proto_CMsgProtoBufHeader
 * @property {string} [steamid]
 * @property {number} [client_sessionid]
 * @property {number} [routing_appid]
 * @property {string} [jobid_source=18446744073709552000]
 * @property {string} [jobid_target=18446744073709552000]
 * @property {string} [target_job_name]
 * @property {number} [seq_num]
 * @property {EResult} [eresult=2]
 * @property {string} [error_message]
 * @property {number} [auth_account_flags]
 * @property {number} [token_source]
 * @property {boolean} [admin_spoofing_user]
 * @property {number} [transport_error=1]
 * @property {string} [messageid=18446744073709552000]
 * @property {number} [publisher_group_id]
 * @property {number} [sysid]
 * @property {string} [trace_tag]
 * @property {number} [webapi_key_id]
 * @property {boolean} [is_from_external_source]
 * @property {number[]} forward_to_sysid
 * @property {number} [cm_sysid]
 * @property {number} [launcher_type=0]
 * @property {number} [realm=0]
 * @property {number} [timeout_ms=-1]
 * @property {string} [debug_source]
 * @property {number} [debug_source_string_index]
 * @property {string} [token_id]
 * @property {number} [ip]
 * @property {Buffer} [ip_v6]
 */

/**
 * @typedef {object} Proto_CMsgMulti
 * @property {number} [size_unzipped]
 * @property {Buffer} [message_body]
 */

/**
 * @typedef {object} Proto_CMsgProtobufWrapped
 * @property {Buffer} [message_body]
 */

/**
 * @typedef {object} Proto_CMsgAuthTicket
 * @property {number} [estate]
 * @property {EResult} [eresult=2]
 * @property {string} [steamid]
 * @property {string} [gameid]
 * @property {number} [h_steam_pipe]
 * @property {number} [ticket_crc]
 * @property {Buffer} [ticket]
 */

/**
 * @typedef {object} Proto_CCDDBAppDetailCommon
 * @property {number} [appid]
 * @property {string} [name]
 * @property {string} [icon]
 * @property {boolean} [tool]
 * @property {boolean} [demo]
 * @property {boolean} [media]
 * @property {boolean} [community_visible_stats]
 * @property {string} [friendly_name]
 * @property {string} [propagation]
 * @property {boolean} [has_adult_content]
 * @property {boolean} [is_visible_in_steam_china]
 * @property {number} [app_type]
 */

/**
 * @typedef {object} Proto_CMsgAppRights
 * @property {boolean} [edit_info]
 * @property {boolean} [publish]
 * @property {boolean} [view_error_data]
 * @property {boolean} [download]
 * @property {boolean} [upload_cdkeys]
 * @property {boolean} [generate_cdkeys]
 * @property {boolean} [view_financials]
 * @property {boolean} [manage_ceg]
 * @property {boolean} [manage_signing]
 * @property {boolean} [manage_cdkeys]
 * @property {boolean} [edit_marketing]
 * @property {boolean} [economy_support]
 * @property {boolean} [economy_support_supervisor]
 * @property {boolean} [manage_pricing]
 * @property {boolean} [broadcast_live]
 * @property {boolean} [view_marketing_traffic]
 * @property {boolean} [edit_store_display_content]
 */

/**
 * @typedef {object} Proto_CCuratorPreferences
 * @property {number} [supported_languages]
 * @property {boolean} [platform_windows]
 * @property {boolean} [platform_mac]
 * @property {boolean} [platform_linux]
 * @property {boolean} [vr_content]
 * @property {boolean} [adult_content_violence]
 * @property {boolean} [adult_content_sex]
 * @property {number} [timestamp_updated]
 * @property {number[]} tagids_curated
 * @property {number[]} tagids_filtered
 * @property {string} [website_title]
 * @property {string} [website_url]
 * @property {string} [discussion_url]
 * @property {boolean} [show_broadcast]
 */

/**
 * @typedef {object} Proto_CLocalizationToken
 * @property {number} [language]
 * @property {string} [localized_string]
 */

/**
 * @typedef {object} Proto_CClanEventUserNewsTuple
 * @property {number} [clanid]
 * @property {string} [event_gid]
 * @property {string} [announcement_gid]
 * @property {number} [rtime_start]
 * @property {number} [rtime_end]
 * @property {number} [priority_score]
 * @property {number} [type]
 * @property {number} [clamp_range_slot]
 * @property {number} [appid]
 * @property {number} [rtime32_last_modified]
 */

/**
 * @typedef {object} Proto_CClanMatchEventByRange
 * @property {number} [rtime_before]
 * @property {number} [rtime_after]
 * @property {number} [qualified]
 * @property {Proto_CClanEventUserNewsTuple[]} events
 */

/**
 * @typedef {object} Proto_CCommunity_ClanAnnouncementInfo
 * @property {string} [gid]
 * @property {string} [clanid]
 * @property {string} [posterid]
 * @property {string} [headline]
 * @property {number} [posttime]
 * @property {number} [updatetime]
 * @property {string} [body]
 * @property {number} [commentcount]
 * @property {string[]} tags
 * @property {number} [language]
 * @property {boolean} [hidden]
 * @property {string} [forum_topic_id]
 * @property {string} [event_gid]
 * @property {number} [voteupcount]
 * @property {number} [votedowncount]
 * @property {EBanContentCheckResult} [ban_check_result]
 */

/**
 * @typedef {object} Proto_CClanEventData
 * @property {string} [gid]
 * @property {string} [clan_steamid]
 * @property {string} [event_name]
 * @property {EProtoClanEventType} [event_type]
 * @property {number} [appid]
 * @property {string} [server_address]
 * @property {string} [server_password]
 * @property {number} [rtime32_start_time]
 * @property {number} [rtime32_end_time]
 * @property {number} [comment_count]
 * @property {string} [creator_steamid]
 * @property {string} [last_update_steamid]
 * @property {string} [event_notes]
 * @property {string} [jsondata]
 * @property {Proto_CCommunity_ClanAnnouncementInfo} [announcement_body]
 * @property {boolean} [published]
 * @property {boolean} [hidden]
 * @property {number} [rtime32_visibility_start]
 * @property {number} [rtime32_visibility_end]
 * @property {number} [broadcaster_accountid]
 * @property {number} [follower_count]
 * @property {number} [ignore_count]
 * @property {string} [forum_topic_id]
 * @property {number} [rtime32_last_modified]
 * @property {string} [news_post_gid]
 * @property {number} [rtime_mod_reviewed]
 * @property {number} [featured_app_tagid]
 * @property {number[]} referenced_appids
 * @property {number} [build_id]
 * @property {string} [build_branch]
 */

/**
 * @typedef {object} Proto_CBilling_Address
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [address1]
 * @property {string} [address2]
 * @property {string} [city]
 * @property {string} [us_state]
 * @property {string} [country_code]
 * @property {string} [postcode]
 * @property {number} [zip_plus4]
 * @property {string} [phone]
 */

/**
 * @typedef {object} Proto_CPackageReservationStatus
 * @property {number} [packageid]
 * @property {number} [reservation_state]
 * @property {number} [queue_position]
 * @property {number} [total_queue_size]
 * @property {string} [reservation_country_code]
 * @property {boolean} [expired]
 * @property {number} [time_expires]
 * @property {number} [time_reserved]
 */

/**
 * @typedef {object} Proto_CMsgKeyValuePair
 * @property {string} [name]
 * @property {string} [value]
 */

/**
 * @typedef {object} Proto_CMsgKeyValueSet
 * @property {Proto_CMsgKeyValuePair[]} pairs
 */

///////////////////////////////////////////////
// steammessages_auth.steamclient.proto
///////////////////////////////////////////////

/**
 * @typedef {object} Proto_CAuthentication_GetPasswordRSAPublicKey_Request
 * @property {string} [account_name]
 */

/**
 * @typedef {object} Proto_CAuthentication_GetPasswordRSAPublicKey_Response
 * @property {string} [publickey_mod]
 * @property {string} [publickey_exp]
 * @property {string} [timestamp]
 */

/**
 * @typedef {object} Proto_CAuthentication_BeginAuthSessionViaQR_Request
 * @property {string} [device_friendly_name]
 * @property {EAuthTokenPlatformType} [platform_type]
 */

/**
 * @typedef {object} Proto_CAuthentication_AllowedConfirmation
 * @property {EAuthSessionGuardType} [confirmation_type]
 * @property {string} [associated_message]
 */

/**
 * @typedef {object} Proto_CAuthentication_BeginAuthSessionViaQR_Response
 * @property {string} [client_id]
 * @property {string} [challenge_url]
 * @property {Buffer} [request_id]
 * @property {number} [interval]
 * @property {Proto_CAuthentication_AllowedConfirmation[]} allowed_confirmations
 * @property {number} [version]
 */

/**
 * @typedef {object} Proto_CAuthentication_BeginAuthSessionViaCredentials_Request
 * @property {string} [device_friendly_name]
 * @property {string} [account_name]
 * @property {string} [encrypted_password]
 * @property {string} [encryption_timestamp]
 * @property {boolean} [remember_login]
 * @property {EAuthTokenPlatformType} [platform_type]
 * @property {ESessionPersistence} [persistence]
 * @property {string} [website_id]
 */

/**
 * @typedef {object} Proto_CAuthentication_BeginAuthSessionViaCredentials_Response
 * @property {string} [client_id]
 * @property {Buffer} [request_id]
 * @property {number} [interval]
 * @property {Proto_CAuthentication_AllowedConfirmation[]} allowed_confirmations
 * @property {string} [steamid]
 * @property {string} [weak_token]
 */

/**
 * @typedef {object} Proto_CAuthentication_PollAuthSessionStatus_Request
 * @property {string} [client_id]
 * @property {Buffer} [request_id]
 * @property {string} [token_to_revoke]
 */

/**
 * @typedef {object} Proto_CAuthentication_PollAuthSessionStatus_Response
 * @property {string} [new_client_id]
 * @property {string} [new_challenge_url]
 * @property {string} [refresh_token]
 * @property {string} [access_token]
 * @property {boolean} [had_remote_interaction]
 * @property {string} [account_name]
 */

/**
 * @typedef {object} Proto_CAuthentication_GetAuthSessionInfo_Request
 * @property {string} [client_id]
 */

/**
 * @typedef {object} Proto_CAuthentication_GetAuthSessionInfo_Response
 * @property {string} [ip]
 * @property {string} [geoloc]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [country]
 * @property {EAuthTokenPlatformType} [platform_type]
 * @property {string} [device_friendly_name]
 * @property {number} [version]
 * @property {EAuthSessionSecurityHistory} [login_history]
 * @property {boolean} [requestor_location_mismatch]
 * @property {boolean} [high_usage_login]
 * @property {ESessionPersistence} [requested_persistence]
 */

/**
 * @typedef {object} Proto_CAuthentication_UpdateAuthSessionWithMobileConfirmation_Request
 * @property {number} [version]
 * @property {string} [client_id]
 * @property {string} [steamid]
 * @property {Buffer} [signature]
 * @property {boolean} [confirm=false]
 * @property {ESessionPersistence} [persistence]
 */

/**
 * @typedef {object} Proto_CAuthentication_UpdateAuthSessionWithMobileConfirmation_Response
 */

/**
 * @typedef {object} Proto_CAuthentication_UpdateAuthSessionWithSteamGuardCode_Request
 * @property {string} [client_id]
 * @property {string} [steamid]
 * @property {string} [code]
 * @property {EAuthSessionGuardType} [code_type]
 */

/**
 * @typedef {object} Proto_CAuthentication_UpdateAuthSessionWithSteamGuardCode_Response
 */

/**
 * @typedef {object} Proto_CAuthentication_AccessToken_GenerateForApp_Request
 * @property {string} [refresh_token]
 * @property {string} [steamid]
 */

/**
 * @typedef {object} Proto_CAuthentication_AccessToken_GenerateForApp_Response
 * @property {string} [access_token]
 */

/**
 * @typedef {object} Proto_CAuthentication_GetAuthSessionsForAccount_Request
 */

/**
 * @typedef {object} Proto_CAuthentication_GetAuthSessionsForAccount_Response
 * @property {string[]} client_ids
 */

/**
 * @typedef {object} Proto_CAuthentication_MigrateMobileSession_Request
 * @property {string} [steamid]
 * @property {string} [token]
 * @property {string} [signature]
 */

/**
 * @typedef {object} Proto_CAuthentication_MigrateMobileSession_Response
 * @property {string} [refresh_token]
 * @property {string} [access_token]
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_QueryRefreshTokensByAccount_Request
 * @property {string} [steamid]
 * @property {boolean} [include_revoked_tokens]
 */

/**
 * @typedef {object} Proto_CSupportRefreshTokenDescription
 * @property {string} [token_id]
 * @property {string} [token_description]
 * @property {number} [time_updated]
 * @property {EAuthTokenPlatformType} [platform_type]
 * @property {EAuthTokenState} [token_state]
 * @property {string} [owner_steamid]
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_QueryRefreshTokensByAccount_Response
 * @property {Proto_CSupportRefreshTokenDescription[]} refresh_tokens
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_QueryRefreshTokenByID_Request
 * @property {string} [token_id]
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_QueryRefreshTokenByID_Response
 * @property {Proto_CSupportRefreshTokenDescription[]} refresh_tokens
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_RevokeToken_Request
 * @property {string} [token_id]
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_RevokeToken_Response
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_GetTokenHistory_Request
 * @property {string} [token_id]
 */

/**
 * @typedef {object} Proto_CSupportRefreshTokenAudit
 * @property {number} [action]
 * @property {number} [time]
 * @property {Proto_CMsgIPAddress} [ip]
 * @property {string} [actor]
 */

/**
 * @typedef {object} Proto_CAuthenticationSupport_GetTokenHistory_Response
 * @property {Proto_CSupportRefreshTokenAudit[]} history
 */

/**
 * @typedef {object} Proto_CCloudGaming_CreateNonce_Request
 * @property {string} [platform]
 * @property {number} [appid]
 */

/**
 * @typedef {object} Proto_CCloudGaming_CreateNonce_Response
 * @property {string} [nonce]
 * @property {number} [expiry]
 */

/**
 * @typedef {object} Proto_CCloudGaming_GetTimeRemaining_Request
 * @property {string} [platform]
 * @property {number[]} appid_list
 */

/**
 * @typedef {object} Proto_CCloudGaming_TimeRemaining
 * @property {number} [appid]
 * @property {number} [minutes_remaining]
 */

/**
 * @typedef {object} Proto_CCloudGaming_GetTimeRemaining_Response
 * @property {Proto_CCloudGaming_TimeRemaining[]} entries
 */

/**
 * @typedef {object} Proto_Authentication
 */

/**
 * @typedef {object} Proto_AuthenticationSupport
 */

/**
 * @typedef {object} Proto_CloudGaming
 */

/**
 * @typedef {object} Proto_NoResponse
 */

///////////////////////////////////////////////
// steammessages_base.proto
///////////////////////////////////////////////

///////////////////////////////////////////////
// steammessages_unified_base.steamclient.proto
///////////////////////////////////////////////

