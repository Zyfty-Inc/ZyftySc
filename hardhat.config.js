/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('solidity-coverage')
require("@nomiclabs/hardhat-waffle");
module.exports = {
    solidity: {
        version: "0.8.4",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    paths: {
        sources: "./contracts/",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
  networks: {
      matic: {
            url: "https://rpc-mumbai.maticvigil.com",
            chainId: 80001,
            // Development built-in default deployment account
            accounts: ["46e0483c6cb7a3b10d643a4ecc643633b5c89f73756d7921511fa2ae3bb8040e",
                       "60b34f5cf893cf0463ccaf27c8a4a91509fd79708195afb0909573d9fe6da4cf",
                       "4a9241c5e34cbb3605e69fb781b7391d799de131cdc8ba0c133076789f4f8933",
                       "e91a7857301672ec176f9f8588fb393b382d549605e4440765130709296ed40e"
                        ]
      },
      mandala: {
        url: 'http://127.0.0.1:8545',
        accounts: {
          mnemonic: 'fox sight canyon orphan hotel grow hedgehog build bless august weather swarm',
          path: "m/44'/60'/0'/0",
        },
        chainId: 595
      },
      mandalaNet: {
        url: 'https://acala-mandala-adapter.api.onfinality.io/public',
        accounts: ["46e0483c6cb7a3b10d643a4ecc643633b5c89f73756d7921511fa2ae3bb8040e",
                   "60b34f5cf893cf0463ccaf27c8a4a91509fd79708195afb0909573d9fe6da4cf",
                   "4a9241c5e34cbb3605e69fb781b7391d799de131cdc8ba0c133076789f4f8933",
                   "e91a7857301672ec176f9f8588fb393b382d549605e4440765130709296ed40e"
                    ],
        chainId: 595
      },
      bnb : {
        url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
        accounts: ["46e0483c6cb7a3b10d643a4ecc643633b5c89f73756d7921511fa2ae3bb8040e",
                   "60b34f5cf893cf0463ccaf27c8a4a91509fd79708195afb0909573d9fe6da4cf",
                   "4a9241c5e34cbb3605e69fb781b7391d799de131cdc8ba0c133076789f4f8933",
                   "e91a7857301672ec176f9f8588fb393b382d549605e4440765130709296ed40e"
                    ],
        chainId: 97

      }
  },
  mocha: {
    timeout: 1200000
  }
};
