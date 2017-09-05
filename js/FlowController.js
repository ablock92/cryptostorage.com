// TODO
// change terminology from wallets to keys
// verify final pieces
// review private keys (hex, base58, etc)
// page to configure export options with previews
// plugin and wallet decryption tests (test wallet creation to reveal no address on decryption bug)
// progress bar on wallet generation, export generation
// load dependencies as needed
// what happens without random movement for bitaddress.org? need true randomization
// consult designers
// namespace utils.js
// implement executeCallbackFunctions() and switch some things to multithreaded (like reading files)
// cryptostorage donation addresses
// make qr codes and style smaller
// popup on key generation to reconfirm password
// register shortcut keys for page navigation (enter, y, n)
// paste private key doesn't work in iphone safari
// aes.java needs de-minified

const RUN_TESTS = false;
const DEBUG = true;

/**
 * Invoked when document initialized.
 */
$(document).ready(function() {
	
	// run tests
	if (RUN_TESTS) {
		console.log("Running tests");
		runTests(function(error) {
			if (error) throw error;
			console.log("All tests pass");
		});
	}
	
	// initialize content div and flow controller
	var pageManager = new PageManager($("#content"));
	pageManager.render(function() {
		new FlowController(pageManager, getCryptoPlugins());
	})
});

/**
 * Manages the application flow.
 * 
 * @param pageManager manages page navigation and rendering
 * @param plugins is an array of supported cryptos
 */
function FlowController(pageManager, plugins) {
	
	// track application state
	var state = {};
	state.plugins = plugins;
	
	// render home page
	pageManager.next(new HomeController($("<div>"), onSelectCreate, onSelectImport));
	
	// ------------------------------ CREATE NEW --------------------------------
	
	function onSelectCreate() {
		if (DEBUG) console.log("onSelectCreate()");
		state.goal = Goal.CREATE_STORAGE;
		pageManager.next(new CryptoSelectionController($("<div>"), state, onCryptoSelectionCreate));
	}
	
	function onCryptoSelectionCreate(tickerSymbol) {
		if (DEBUG) console.log("onCryptoSelectionCreate(" + tickerSymbol + ")");
		for (let plugin of plugins) {
			if (plugin.getTickerSymbol() === tickerSymbol) state.plugin = plugin;
		}
		if (!state.plugin) throw new Error("plugin not found with ticker symbol: " + tickerSymbol);
		pageManager.next(new NumKeysController($("<div>"), state, pageManager.getPathTracker(), onNumKeysInput));
	}
	
	function onNumKeysInput(numKeys) {
		if (DEBUG) console.log("onNumKeysInput(" + numKeys + ")");
		assertInt(numKeys);
		state.numKeys = numKeys;
		pageManager.next(new PasswordSelectionController($("<div>"), state, onPasswordSelection))
	}
	
	function onPasswordSelection(passwordEnabled) {
		if (DEBUG) console.log("onPasswordSelection(" + passwordEnabled + ")");
		state.passwordEnabled = passwordEnabled;
		if (passwordEnabled) pageManager.next(new PasswordInputController($("<div>"), state, pageManager.getPathTracker(), onPasswordInput));
		else pageManager.next(new SplitSelectionController($("<div>"), state, onSplitSelection));
	}

	function onPasswordInput(password, encryptionScheme) {
		if (DEBUG) console.log("onPasswordInput(" + password + ", " + encryptionScheme + ")");
		state.password = password;
		state.encryptionScheme = encryptionScheme;
		pageManager.next(new SplitSelectionController($("<div>"), state, onSplitSelection));
	}
	
	function onSplitSelection(splitEnabled) {
		if (DEBUG) console.log("onSplitSelection(" + splitEnabled + ")");
		state.splitEnabled = splitEnabled;
		if (splitEnabled) pageManager.next(new NumPiecesInputController($("<div>"), state, pageManager.getPathTracker(), onSplitInput));
		else pageManager.next(new GenerateKeysController($("<div>"), state, onKeysGenerated));
	}
	
	function onSplitInput(numPieces, minPieces) {
		if (DEBUG) console.log("onSplitInput(" + numPieces + ", " + minPieces + ")");
		assertInt(numPieces);
		assertInt(minPieces);
		state.numPieces = numPieces;
		state.minPieces = minPieces;
		pageManager.next(new GenerateKeysController($("<div>"), state, onKeysGenerated));
	}
	
	function onKeysGenerated(keys) {
		if (DEBUG) console.log("onKeysGenerated(" + keys.length + ")");
		pageManager.next(new DownloadPiecesController($("<div>"), state, keysToPieces(keys), onCustomExport));
	}
	
	// ------------------------------ RESTORE --------------------------------
	
	function onSelectImport() {
		if (DEBUG) console.log("onSelectImport()");
		pageManager.next(new ImportFilesController($("<div>"), onUnsplitWalletsImported, onSelectImportText));
	}
	
	function onSelectImportText() {
		if (DEBUG) console.log("onSelectImportText()");
		state.goal = Goal.RESTORE_STORAGE;
		pageManager.next(new CryptoSelectionController($("<div>"), state, onSelectImportCurrency));
	}
	
	function onSelectImportCurrency(tickerSymbol) {
		if (DEBUG) console.log("onSelectImportCurrency(" + tickerSymbol + ")");
		for (let plugin of plugins) {
			if (plugin.getTickerSymbol() === tickerSymbol) state.plugin = plugin;
		}
		if (!state.plugin) throw new Error("plugin not found with ticker symbol: " + tickerSymbol);
		pageManager.next(new ImportTextController($("<div>"), state, onUnsplitWalletsImported));
	}
	
	function onUnsplitWalletsImported(wallets) {
		if (DEBUG) console.log("onUnsplitWalletsImported(" + wallets.length + " wallets)");
		assertTrue(wallets.length >= 1);
		state.wallets = wallets;
		state.plugin = wallets[0].getCurrencyPlugin();
		if (wallets[0].isEncrypted()) pageManager.next(new DecryptWalletsController($("<div>"), state, onUnsplitWalletsImported));
		else pageManager.next(new DownloadPiecesController($("<div>"), state, keysToPieces(wallets, true), onCustomExport));
	}
	
	function onCustomExport(pieces) {
		if (DEBUG) console.log("onCustomExport(" + pieces.length + ")");
		assertTrue(pieces.length > 0);
		pageManager.next(new CustomExportController($("<div>"), state, pieces));
	}
}