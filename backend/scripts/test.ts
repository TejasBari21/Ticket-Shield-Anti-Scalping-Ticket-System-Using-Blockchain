import hre from "hardhat";

async function main() {
  console.log("Compiling contracts...");
  await hre.run("compile");

  console.log("Running basic tests...\n");

  // Test 1: Deploy contract
  console.log("Test 1: Contract Deployment");
  const EventTicket = await hre.ethers.getContractFactory("EventTicket");
  const [deployerSigner] = await hre.ethers.getSigners();
  const contract = await EventTicket.deploy(deployerSigner.address);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅ Contract deployed at: ${address}\n`);

  // Test 2: Create Event
  console.log("Test 2: Create Event");
  const futureDate = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now

  const createEventTx = await contract.createEvent(
    "Test Event",
    "A test event for the smart contract",
    futureDate,
    "Virtual",
    100,
    hre.ethers.parseEther("0.1")
  );
  await createEventTx.wait();
  console.log(`✅ Event created\n`);

  // Test 3: Get Event
  console.log("Test 3: Get Event Details");
  const event = await (contract as any).getEvent(BigInt(0)) as any;
  console.log(`Event Name: ${event.name}`);
  console.log(`Total Capacity: ${event.totalCapacity}`);
  console.log(`Base Price: ${hre.ethers.formatEther(event.basePrice)} ETH\n`);

  // Test 4: Mint Ticket
  console.log("Test 4: Mint Ticket");
  const ticketPrice = hre.ethers.parseEther("0.1");
  const mintTx = await (contract as any).mintTicket(0, deployerSigner.address, {
    value: ticketPrice,
  });
  await mintTx.wait();
  console.log(`✅ Ticket minted\n`);

  // Test 5: Get Ticket
  console.log("Test 5: Get Ticket Details");
  const ticket = await (contract as any).getTicket(0);
  console.log(`Event ID: ${ticket.eventId}`);
  console.log(`Checked In: ${ticket.checkedIn}`);
  console.log(`Original Owner: ${ticket.originalOwner.slice(0, 10)}...\n`);

  // Test 6: List for Resale
  console.log("Test 6: List Ticket for Resale");
  const resalePrice = hre.ethers.parseEther("0.15");
  const listTx = await (contract as any).listForResale(0, resalePrice);
  await listTx.wait();
  console.log(`✅ Ticket listed for resale at ${hre.ethers.formatEther(resalePrice)} ETH\n`);

  // Test 7: Get Resale Offer
  console.log("Test 7: Get Resale Offer");
  const offer = await (contract as any).getResaleOffer(0);
  console.log(`Seller: ${offer.seller.slice(0, 10)}...`);
  console.log(`Price: ${hre.ethers.formatEther(offer.price)} ETH`);
  console.log(`Active: ${offer.active}\n`);

  // Test 8: Check-in
  console.log("Test 8: Check-in Ticket");
  const checkInTx = await (contract as any).checkInTicket(0, "");
  await checkInTx.wait();
  console.log(`✅ Ticket checked in\n`);

  // Test 9: Verify Check-in
  console.log("Test 9: Verify Check-in Status");
  const isCheckedIn = await (contract as any).isCheckedIn(0);
  console.log(`Ticket Checked In: ${isCheckedIn}\n`);

  // Test 10: Get Platform Info
  console.log("Test 10: Get Platform Information");
  const { totalBalance, feesCollected } = await contract.getContractBalance();
  console.log(`Total Balance: ${hre.ethers.formatEther(totalBalance)} ETH`);
  console.log(`Fees Collected: ${hre.ethers.formatEther(feesCollected)} ETH`);
  const feePercentage = await contract.platformFeePercentage();
  console.log(`Platform Fee: ${feePercentage}%\n`);

  console.log("✅ All tests completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
