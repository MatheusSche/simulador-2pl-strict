module.exports = class Lock {
  constructor(transaction, exclusive, resource, released=false) {
    this.transaction = transaction;
    this.exclusive = exclusive;
    this.resource = resource;
    this.released = released;

  }

  format_str(){
    const exc = this.exclusive?'exclusive':'shared';
    return `Lock - ${this.transaction} - ${exc} - ${this.resource}`;
  }

  format_as_history(){
    const operation = !(this.released)?'l':'u';
    const lock_type = this.exclusive?'x':'s';

    return `${operation}${lock_type}${this.transaction}[${this.resource}]`;
  }
}