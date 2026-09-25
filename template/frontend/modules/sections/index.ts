// Side-effect imports, not re-exports: importing the module is what calls
// defineElement, and a bundler may drop a re-export nobody reads.
import './cart-drawer';
import './example';
