module.exports = class Transaction {
  constructor(value) {
    this.is_growing = true;
    this.value = value;
  }

  format_str(){
    return `Transacao - ${this.value}`;
  }
  
}
