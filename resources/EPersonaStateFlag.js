/**
 * @enum EPersonaStateFlag
 */
module.exports = {
	"HasRichPresence": 1,
	"InJoinableGame": 2,
	"Golden": 4,
	"RemotePlayTogether": 8,
	"OnlineUsingWeb": 256, // removed "renamed to ClientTypeWeb"
	"ClientTypeWeb": 256,
	"OnlineUsingMobile": 512, // removed "renamed to ClientTypeMobile"
	"ClientTypeMobile": 512,
	"OnlineUsingBigPicture": 1024, // removed "renamed to ClientTypeTenfoot"
	"ClientTypeTenfoot": 1024,
	"OnlineUsingVR": 2048, // removed "renamed to ClientTypeVR"
	"ClientTypeVR": 2048,
	"LaunchTypeGamepad": 4096,
	"LaunchTypeCompatTool": 8192,

	// Value-to-name mapping for convenience
	"1": "HasRichPresence",
	"2": "InJoinableGame",
	"4": "Golden",
	"8": "RemotePlayTogether",
	"256": "ClientTypeWeb",
	"512": "ClientTypeMobile",
	"1024": "ClientTypeTenfoot",
	"2048": "ClientTypeVR",
	"4096": "LaunchTypeGamepad",
	"8192": "LaunchTypeCompatTool",
};

