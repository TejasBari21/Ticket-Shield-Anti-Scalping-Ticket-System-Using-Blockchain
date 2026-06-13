import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const contractAddress = process.env.VITE_CONTRACT_ADDRESS;
  const newOwnerAddress = process.env.VITE_ADMIN_ADDRESS || process.env.ADMIN_PAYOUT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Missing VITE_CONTRACT_ADDRESS in backend/.env");
  }

  if (!newOwnerAddress) {
    throw new Error("Missing VITE_ADMIN_ADDRESS or ADMIN_PAYOUT_ADDRESS in backend/.env");
  }

  console.log("Transferring contract ownership...");
  console.log(`Contract: ${contractAddress}`);
  console.log(`New Owner: ${newOwnerAddress}`);

  // Get contract instance
  const EventTicket = await hre.ethers.getContractAt("EventTicket", contractAddress);

  const currentOwner = await EventTicket.owner();
  if (currentOwner.toLowerCase() === newOwnerAddress.toLowerCase()) {
    console.log("✅ Ownership already set to target address.");
    return;
  }

  // Transfer ownership
  const tx = await EventTicket.transferOwnership(newOwnerAddress);
  console.log(`📤 Transaction sent: ${tx.hash}`);

  // Wait for confirmation
  const receipt = await tx.wait();
  console.log(`✅ Ownership transferred successfully!`);
  console.log(`\n🔐 New Owner: ${newOwnerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
