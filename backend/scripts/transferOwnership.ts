import hre from "hardhat";

async function main() {
  const contractAddress = "0xCfEB869F69431e42cdB54A4F4f105C19C080A601";
  const newOwnerAddress = "0x78cbc741805e576e7a3ac4a9a6495e23c7e38309";

  console.log("Transferring contract ownership...");
  console.log(`Contract: ${contractAddress}`);
  console.log(`New Owner: ${newOwnerAddress}`);

  // Get contract instance
  const EventTicket = await hre.ethers.getContractAt("EventTicket", contractAddress);

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
