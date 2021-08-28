/**
 * ~getConfirmations
 */
export type SteamCommunity = (err: Error | null, confirmations: CConfirmation[]) => any;
import CConfirmation = require("../classes/CConfirmation.js");
