import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Deploying EventTicket contract...");

  // Get the contract factory
  const EventTicket = await hre.ethers.getContractFactory("EventTicket");

  const [deployer] = await hre.ethers.getSigners();
  const configuredAdminWallet =
    process.env.ADMIN_PAYOUT_ADDRESS ||
    process.env.VITE_ADMIN_ADDRESS ||
    deployer.address;

  console.log(`Payout wallet: ${configuredAdminWallet}`);

  // Deploy the contract
  const contract = await EventTicket.deploy(configuredAdminWallet);

  // Wait for deployment
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("✅ EventTicket deployed successfully!");
  console.log(`📍 Contract address: ${address}`);
  console.log(`\n⚠️  Save this address in your .env file:`);
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);

  // Verify contract details
  console.log("\n📋 Contract Details:");
  const platformFee = await contract.platformFeePercentage();
  console.log(`Platform Fee: ${platformFee}%`);
  console.log(`Payout Wallet: ${await contract.payoutWallet()}`);

  // Print verification command
  console.log(`\n🔐 Deployed by: ${deployer.address}`);

  // Save deployment info to file
  const deploymentInfo = {
    address,
    deployer: deployer.address,
    payoutWallet: await contract.payoutWallet(),
    network: hre.network.name,
    timestamp: new Date().toISOString(),
  };

  const fs = await import("fs");
  const path = await import("path");

  const deploymentPath = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  const filename = path.join(
    deploymentPath,
    `EventTicket_${hre.network.name}_${Date.now()}.json`
  );
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n💾 Deployment info saved to: ${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
